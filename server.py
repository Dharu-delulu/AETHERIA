import taichi as ti
import numpy as np
import math
import asyncio
import websockets
import json
import threading
import http.server
import socketserver
import os
import webbrowser

# -----------------------------------------------------------------------------
# 1. TAICHI GPU N-BODY GALACTIC MERGER ENGINE
# -----------------------------------------------------------------------------
ti.init(arch=ti.gpu)

NUM_STARS = 30_000
G = 1.2
SOFTENING = 0.035
DT = 0.0012

# Particle Fields
pos = ti.Vector.field(3, dtype=ti.f32, shape=NUM_STARS)
vel = ti.Vector.field(3, dtype=ti.f32, shape=NUM_STARS)
color = ti.Vector.field(3, dtype=ti.f32, shape=NUM_STARS)
mass = ti.field(dtype=ti.f32, shape=NUM_STARS)

# Supermassive Black Holes (SMBH)
smbh_pos = ti.Vector.field(3, dtype=ti.f32, shape=2)
smbh_vel = ti.Vector.field(3, dtype=ti.f32, shape=2)
smbh_mass = ti.field(dtype=ti.f32, shape=2)

# Global Telemetry Fields
webcam_thrust = ti.Vector.field(3, dtype=ti.f32, shape=())
impact_velocity = ti.field(dtype=ti.f32, shape=())
collision_epoch = ti.field(dtype=ti.f32, shape=())

@ti.kernel
def setup_galaxies(impact_v: ti.f32, angle_rad: ti.f32, mass_ratio: ti.f32):
    collision_epoch[None] = 0.0
    impact_velocity[None] = impact_v

    smbh_mass[0] = 850.0
    smbh_mass[1] = 850.0 * mass_ratio

    dist = 1.8
    smbh_pos[0] = ti.Vector([-dist * 0.5, -0.2, 0.0])
    smbh_pos[1] = ti.Vector([ dist * 0.5,  0.2, 0.15])

    v_mag = impact_v
    smbh_vel[0] = ti.Vector([ v_mag * 0.45,  0.18, 0.0])
    smbh_vel[1] = ti.Vector([-v_mag * 0.45, -0.18 * ti.cos(angle_rad), -0.18 * ti.sin(angle_rad)])

    half = NUM_STARS // 2

    for i in range(NUM_STARS):
        g_idx = 0 if i < half else 1
        center = smbh_pos[g_idx]
        c_vel = smbh_vel[g_idx]
        central_m = smbh_mass[g_idx]

        u = ti.random()
        r = 0.12 + 0.65 * ti.sqrt(u)
        theta = ti.random() * 6.2831853
        z = (ti.random() - 0.5) * 0.035

        v_circ = ti.sqrt(G * central_m / (r + 0.05))

        lx = r * ti.cos(theta)
        ly = r * ti.sin(theta)
        lz = z

        vx = -v_circ * ti.sin(theta)
        vy =  v_circ * ti.cos(theta)
        vz = 0.0

        if g_idx == 1:
            ly_rot = ly * ti.cos(angle_rad) - lz * ti.sin(angle_rad)
            lz_rot = ly * ti.sin(angle_rad) + lz * ti.cos(angle_rad)
            ly, lz = ly_rot, lz_rot

            vx = -v_circ * ti.sin(theta)
            vy =  v_circ * ti.cos(theta) * ti.cos(angle_rad)
            vz =  v_circ * ti.cos(theta) * ti.sin(angle_rad)

            color[i] = ti.Vector([1.0, 0.72, 0.28])
        else:
            color[i] = ti.Vector([0.25, 0.85, 1.0])

        pos[i] = center + ti.Vector([lx, ly, lz])
        vel[i] = c_vel + ti.Vector([vx, vy, vz])
        mass[i] = 0.01

@ti.kernel
def compute_nbody_step():
    collision_epoch[None] += DT * 15.0
    thrust = webcam_thrust[None]

    r_bh = smbh_pos[1] - smbh_pos[0]
    dist_bh = r_bh.norm() + SOFTENING
    force_bh = G * (smbh_mass[0] * smbh_mass[1]) / (dist_bh**3) * r_bh

    smbh_vel[0] += ( force_bh / smbh_mass[0]) * DT
    smbh_vel[1] += (-force_bh / smbh_mass[1] + thrust * 0.8) * DT

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

# Initial setup
setup_galaxies(0.85, math.radians(45.0), 1.0)

# -----------------------------------------------------------------------------
# 2. WEBSOCKET TAICHI GPU STREAMING SERVER (Port 8765)
# -----------------------------------------------------------------------------
connected_clients = set()

async def ws_handler(websocket):
    connected_clients.add(websocket)
    print(f"[WebSocket 8765] Client connected: {websocket.remote_address}")
    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                action = data.get("action")
                if action == "reseed":
                    impact_v = float(data.get("impact_vel", 0.85))
                    angle = float(data.get("angle", 45.0))
                    mass_ratio = float(data.get("mass_ratio", 1.0))
                    setup_galaxies(impact_v, math.radians(angle), mass_ratio)
                    print(f"[WebSocket] Reseeded galaxies: v={impact_v}, angle={angle}deg, ratio={mass_ratio}")
                elif action == "thrust":
                    tx = float(data.get("x", 0.0))
                    ty = float(data.get("y", 0.0))
                    webcam_thrust[None] = ti.Vector([tx, ty, 0.0])
            except Exception as e:
                print(f"[WebSocket Error] Failed to parse client message: {e}")
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        connected_clients.remove(websocket)
        print(f"[WebSocket 8765] Client disconnected: {websocket.remote_address}")

async def broadcast_simulation_loop():
    while True:
        # Step Taichi physics on GPU (4 substeps per frame for stability)
        for _ in range(4):
            compute_nbody_step()

        if connected_clients:
            # Extract GPU numpy buffers
            pos_np = pos.to_numpy() # shape (30000, 3)
            col_np = color.to_numpy() # shape (30000, 3)
            smbh_np = smbh_pos.to_numpy() # shape (2, 3)

            # Convert to flat list for JSON transmission
            payload = json.dumps({
                "type": "frame",
                "epoch": round(float(collision_epoch[None]), 1),
                "num_stars": NUM_STARS,
                "positions": pos_np.flatten().round(4).tolist(),
                "colors": col_np.flatten().round(3).tolist(),
                "smbh": smbh_np.flatten().round(4).tolist()
            })

            # Broadcast to all connected clients
            websockets.broadcast(connected_clients, payload)

        await asyncio.sleep(0.033)  # ~30 FPS streaming

# -----------------------------------------------------------------------------
# 3. HTTP STATIC FILE SERVER (Port 8000)
# -----------------------------------------------------------------------------
HTTP_PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

def start_http_server():
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=DIRECTORY, **kwargs)

    with socketserver.TCPServer(("", HTTP_PORT), Handler) as httpd:
        print(f"[HTTP Server] Serving Supernova Lab at http://localhost:{HTTP_PORT}")
        httpd.serve_forever()

if __name__ == "__main__":
    # Start HTTP server in a daemon thread
    http_thread = threading.Thread(target=start_http_server, daemon=True)
    http_thread.start()

    print("[Taichi GPU] Initializing Galactic N-Body Engine...")
    print("[WebSocket] Starting server on ws://localhost:8765")
    webbrowser.open(f"http://localhost:{HTTP_PORT}")

    async def main():
        async with websockets.serve(ws_handler, "0.0.0.0", 8765):
            await broadcast_simulation_loop()

    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[Server] Stopped.")
