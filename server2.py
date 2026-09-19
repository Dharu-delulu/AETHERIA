import asyncio
import websockets
import json
import numpy as np
import taichi as ti
import math

# -----------------------------------------------------------------------------
# 1. TAICHI GPU PHYSICS ENGINE
# -----------------------------------------------------------------------------
ti.init(arch=ti.gpu)

NUM_STARS = 40_000
G = 1.35
SOFTENING = 0.045
DT = 0.0010

# Particle Arrays
pos = ti.Vector.field(3, dtype=ti.f32, shape=NUM_STARS)
vel = ti.Vector.field(3, dtype=ti.f32, shape=NUM_STARS)
color = ti.Vector.field(3, dtype=ti.f32, shape=NUM_STARS)

# Supermassive Black Holes (SMBH)
smbh_pos = ti.Vector.field(3, dtype=ti.f32, shape=2)
smbh_vel = ti.Vector.field(3, dtype=ti.f32, shape=2)
smbh_mass = ti.field(dtype=ti.f32, shape=2)

# Telemetry
sim_time_myr = ti.field(dtype=ti.f32, shape=())
core_distance = ti.field(dtype=ti.f32, shape=())
core_velocity = ti.field(dtype=ti.f32, shape=())

@ti.kernel
def setup_galaxies(impact_v: ti.f32, angle_rad: ti.f32, mass_ratio: ti.f32):
    sim_time_myr[None] = 0.0

    smbh_mass[0] = 950.0
    smbh_mass[1] = 950.0 * mass_ratio

    dist = 2.1
    smbh_pos[0] = ti.Vector([-dist * 0.5, -0.22, 0.0])
    smbh_pos[1] = ti.Vector([ dist * 0.5,  0.22, 0.12])

    smbh_vel[0] = ti.Vector([ impact_v * 0.45,  0.15, 0.0])
    smbh_vel[1] = ti.Vector([-impact_v * 0.45, -0.15 * ti.cos(angle_rad), -0.15 * ti.sin(angle_rad)])

    half = NUM_STARS // 2

    for i in range(NUM_STARS):
        g_idx = 0 if i < half else 1
        center = smbh_pos[g_idx]
        c_vel = smbh_vel[g_idx]
        central_m = smbh_mass[g_idx]

        is_bulge = 1 if (ti.random() < 0.30) else 0
        r = 0.0
        theta = 0.0
        z = 0.0

        if is_bulge == 1:
            r = 0.02 + 0.15 * ti.sqrt(ti.random())
            theta = ti.random() * 2.0 * math.pi
            z = (ti.random() - 0.5) * 0.08
        else:
            arm_offset = 0.0 if ti.random() < 0.5 else math.pi
            r_sample = 0.15 + 0.70 * ti.sqrt(ti.random())
            r = r_sample
            spiral_twist = 3.2
            theta = ti.log(r / 0.15 + 1e-4) * spiral_twist + arm_offset + (ti.random() - 0.5) * 0.42
            z = (ti.random() - 0.5) * 0.035

        v_circ = ti.sqrt(G * central_m / (r + 0.06))

        lx = r * ti.cos(theta)
        ly = r * ti.sin(theta)
        lz = z

        vx = 0.0
        vy = 0.0
        vz = 0.0

        if g_idx == 1:
            ly_rot = ly * ti.cos(angle_rad) - lz * ti.sin(angle_rad)
            lz_rot = ly * ti.sin(angle_rad) + lz * ti.cos(angle_rad)
            lx = lx
            ly = ly_rot
            lz = lz_rot

            vx = -v_circ * ti.sin(theta)
            vy =  v_circ * ti.cos(theta) * ti.cos(angle_rad)
            vz =  v_circ * ti.cos(theta) * ti.sin(angle_rad)

            if is_bulge == 1:
                color[i] = ti.Vector([1.0, 0.92, 0.75])
            else:
                color[i] = ti.Vector([1.0, 0.60, 0.20])
        else:
            vx = -v_circ * ti.sin(theta)
            vy =  v_circ * ti.cos(theta)
            vz = 0.0

            if is_bulge == 1:
                color[i] = ti.Vector([0.90, 0.95, 1.0])
            else:
                color[i] = ti.Vector([0.22, 0.70, 1.0])

        pos[i] = center + ti.Vector([lx, ly, lz])
        vel[i] = c_vel + ti.Vector([vx, vy, vz])

@ti.kernel
def compute_nbody_step():
    sim_time_myr[None] += DT * 18.0

    r_bh = smbh_pos[1] - smbh_pos[0]
    dist_bh = r_bh.norm() + SOFTENING
    core_distance[None] = dist_bh * 65.0
    core_velocity[None] = (smbh_vel[1] - smbh_vel[0]).norm() * 240.0

    force_bh = G * (smbh_mass[0] * smbh_mass[1]) / (dist_bh**3) * r_bh
    smbh_vel[0] += ( force_bh / smbh_mass[0]) * DT
    smbh_vel[1] += (-force_bh / smbh_mass[1]) * DT

    smbh_pos[0] += smbh_vel[0] * DT
    smbh_pos[1] += smbh_vel[1] * DT

    for i in range(NUM_STARS):
        p = pos[i]
        acc = ti.Vector([0.0, 0.0, 0.0])

        d0 = smbh_pos[0] - p
        r0 = d0.norm() + SOFTENING
        acc += G * smbh_mass[0] / (r0**3) * d0

        d1 = smbh_pos[1] - p
        r1 = d1.norm() + SOFTENING
        acc += G * smbh_mass[1] / (r1**3) * d1

        vel[i] += acc * DT
        pos[i] += vel[i] * DT

# -----------------------------------------------------------------------------
# 2. WEBSOCKET DISPATCHER (BINARY COORDINATE STREAMING)
# -----------------------------------------------------------------------------
class SimulationState:
    def __init__(self):
        self.is_running = True
        self.impact_vel = 0.85
        self.angle_deg = 40.0
        self.mass_ratio = 1.0

state = SimulationState()
setup_galaxies(state.impact_vel, math.radians(state.angle_deg), state.mass_ratio)

async def handler(websocket):
    print(f"[WebSocket] Client connected: {websocket.remote_address}")

    # Send initial color buffer once on connection (RGB float32)
    colors_np = color.to_numpy().astype(np.float32)
    await websocket.send(colors_np.tobytes())

    async def receiver():
        async for message in websocket:
            try:
                cmd = json.loads(message)
                if cmd.get("type") == "TOGGLE_PLAY":
                    state.is_running = not state.is_running
                elif cmd.get("type") == "RESET":
                    state.impact_vel = float(cmd.get("impactVel", state.impact_vel))
                    state.angle_deg = float(cmd.get("angleDeg", state.angle_deg))
                    state.mass_ratio = float(cmd.get("massRatio", state.mass_ratio))
                    setup_galaxies(state.impact_vel, math.radians(state.angle_deg), state.mass_ratio)
            except Exception as e:
                print(f"[Error parsing command]: {e}")

    async def sender():
        while True:
            if state.is_running:
                for _ in range(4):
                    compute_nbody_step()

            # Pack 40,000 star positions + 2 black hole positions
            stars_np = pos.to_numpy().astype(np.float32)
            smbh_np = smbh_pos.to_numpy().astype(np.float32)
            frame_coords = np.vstack((stars_np, smbh_np))

            # Send position bytes
            await websocket.send(frame_coords.tobytes())

            # Send telemetry JSON
            telemetry = {
                "type": "TELEMETRY",
                "time": round(float(sim_time_myr[None]), 1),
                "dist": round(float(core_distance[None]), 1),
                "vel": round(float(core_velocity[None]), 1),
                "running": state.is_running
            }
            await websocket.send(json.dumps(telemetry))

            # ~60 FPS rate limiting
            await asyncio.sleep(0.016)

    try:
        await asyncio.gather(receiver(), sender())
    except websockets.exceptions.ConnectionClosed:
        print("[WebSocket] Client disconnected.")

async def main():
    print("[Observatory Core] WebSocket Server running on ws://localhost:8765")
    async with websockets.serve(handler, "localhost", 8765, max_size=10_000_000):
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())