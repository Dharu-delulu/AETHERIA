import taichi as ti
import numpy as np
import cv2
import mediapipe as mp
import speech_recognition as sr
import threading
import time
import math

# -----------------------------------------------------------------------------
# 1. TAICHI HIGH-PERFORMANCE GPU SIMULATION ENGINE
# -----------------------------------------------------------------------------
# Automatically selects CUDA (NVIDIA), Metal (Apple), Vulkan, or falls back to CPU
ti.init(arch=ti.gpu if ti.cuda.is_available() else ti.cpu)

NUM_PARTICLES = 150_000
DT = 0.0006

# Particle Fields
pos = ti.Vector.field(3, dtype=ti.f32, shape=NUM_PARTICLES)
vel = ti.Vector.field(3, dtype=ti.f32, shape=NUM_PARTICLES)
color = ti.Vector.field(3, dtype=ti.f32, shape=NUM_PARTICLES)
temp = ti.field(dtype=ti.f32, shape=NUM_PARTICLES)

# State and Boundary Conditions
is_collapsed = ti.field(dtype=ti.i32, shape=())
element_mode = ti.field(dtype=ti.i32, shape=())   # 0: H/He, 1: C/O, 2: Si/Fe
hand_force_pos = ti.Vector.field(3, dtype=ti.f32, shape=())
hand_active = ti.field(dtype=ti.i32, shape=())
sim_time = ti.field(dtype=ti.f32, shape=())

@ti.kernel
def initialize_star():
    is_collapsed[None] = 0
    element_mode[None] = 2  # Default to pre-collapse degenerate Iron core
    hand_active[None] = 0
    sim_time[None] = 0.0
    hand_force_pos[None] = ti.Vector([0.0, 0.0, 0.0])

    for i in range(NUM_PARTICLES):
        # Generate 3D spherical core distribution with cubic radial density falloff
        u = ti.random()
        v = ti.random()
        theta = u * 2.0 * math.pi
        phi = ti.acos(2.0 * v - 1.0)
        r = ti.pow(ti.random(), 0.35) * 0.40

        pos[i] = ti.Vector([
            r * ti.sin(phi) * ti.cos(theta),
            r * ti.sin(phi) * ti.sin(theta),
            r * ti.cos(phi)
        ])

        # Initial convective differential velocity
        vel[i] = ti.Vector([
            -pos[i][1] * 0.35 + (ti.random() - 0.5) * 0.05,
             pos[i][0] * 0.35 + (ti.random() - 0.5) * 0.05,
            (ti.random() - 0.5) * 0.05
        ])

        temp[i] = 3.5e8  # 350 Million Kelvin
        color[i] = ti.Vector([1.0, 0.25, 0.08])

@ti.func
def compute_blackbody_radiation(t: ti.f32) -> ti.Vector:
    """Computes Planck emission spectrum mapping from temperature"""
    c = ti.Vector([1.0, 1.0, 1.0])
    if t > 6.0e7:
        c = ti.Vector([0.8, 0.95, 1.0])  # Blue-white relativistic peak
    elif t > 2.5e7:
        c = ti.Vector([1.0, 0.92, 0.65]) # Mid-stage yellow flash
    elif t > 7.0e6:
        c = ti.Vector([1.0, 0.28, 0.05]) # Expanding cooler envelope (Red)
    else:
        c = ti.Vector([0.45, 0.08, 0.3]) # Synchrotron emission remnant (Purple)
    return c

@ti.kernel
def compute_physics_step():
    sim_time[None] += DT
    t = sim_time[None]
    hp = hand_force_pos[None]
    h_on = hand_active[None]

    for i in range(NUM_PARTICLES):
        p = pos[i]
        r = p.norm() + 1e-4

        if is_collapsed[None] == 0:
            # --- PHASE 1: HYDROSTATIC EQUILIBRIUM & SASI INSTABILITIES ---
            # Balance between gravitational inward attraction and thermal radiation outward
            grav = -p / (r**3) * 0.32
            outward_pressure = (p / r) * (0.32 / (r + 0.08))

            # SASI (Standing Accretion Shock Instability) mode oscillations
            sasi = ti.Vector([
                ti.sin(p[1] * 9.0 + t * 15.0) * 0.12,
                ti.cos(p[0] * 9.0 + t * 15.0) * 0.12,
                ti.sin(p[2] * 9.0 + t * 15.0) * 0.12
            ])

            # Hand Optical Displacement Force
            h_force = ti.Vector([0.0, 0.0, 0.0])
            if h_on == 1:
                diff = hp - p
                dist = diff.norm() + 0.15
                h_force = (diff / (dist**3)) * 0.30

            vel[i] += (grav + outward_pressure + sasi + h_force) * DT
            vel[i] *= 0.982  # Viscous damping
            pos[i] += vel[i] * DT

            # Dynamic Spectral Color based on Composition
            if element_mode[None] == 0:
                color[i] = ti.Vector([0.2, 0.6, 1.0])   # Hydrogen/Helium (Hot Blue)
            elif element_mode[None] == 1:
                color[i] = ti.Vector([0.1, 0.95, 0.75]) # Carbon/Oxygen (Cyan)
            else:
                color[i] = ti.Vector([1.0, 0.3, 0.05])  # Silicon/Iron (Crimson Orange)

        else:
            # --- PHASE 2: CORE COLLAPSE & RELATIVISTIC SHOCK FRONT ---
            dir_norm = p.norm() + 1e-4
            outward = p / dir_norm

            # Asymmetric Rayleigh-Taylor & Richtmyer-Meshkov Finger Instabilities
            finger_noise = (
                ti.sin(outward[0] * 14.0) *
                ti.cos(outward[1] * 14.0) *
                ti.sin(outward[2] * 14.0)
            ) * 0.45

            shock_acceleration = outward * (3.4 + finger_noise)
            vel[i] += shock_acceleration * DT
            pos[i] += vel[i] * DT

            # Thermodynamic radiative cooling curve
            temp[i] = ti.max(8.0e5, temp[i] * 0.9982)
            color[i] = compute_blackbody_radiation(temp[i])


# -----------------------------------------------------------------------------
# 2. ANTIGRAVITY AGENTIC DISPATCH ORCHESTRATOR
# -----------------------------------------------------------------------------
class AntigravityMultimodalAgent:
    """
    Coordinates background sensor streams into synchronous Taichi GPU buffers.
    """
    def __init__(self):
        self.is_alive = True
        self.hand_norm_x = 0.0
        self.hand_norm_y = 0.0
        self.pinch_active = False

        self.telemetry = {
            "phase": "HYDROSTATIC EQUILIBRIUM",
            "density": "2.8 × 10⁹ g/cm³",
            "temp": "3.5 × 10⁸ K",
            "element": "Silicon-28 -> Iron-56",
            "voice_status": "Receptor Open..."
        }

    def voice_receptor_worker(self):
        """Asynchronous audio dispatcher for voice commands."""
        rec = sr.Recognizer()
        rec.energy_threshold = 280
        mic = sr.Microphone()

        with mic as src:
            rec.adjust_for_ambient_noise(src, duration=1.0)

        while self.is_alive:
            try:
                with mic as src:
                    audio = rec.listen(src, timeout=3, phrase_time_limit=3)
                cmd = rec.recognize_google(audio).lower()
                self.telemetry["voice_status"] = f">> {cmd}"
                print(f"[Agentic Vocal Receptor] Ingested: '{cmd}'")

                if any(k in cmd for k in ["collapse", "supernova", "detonate", "explode", "breakout"]):
                    is_collapsed[None] = 1
                    self.telemetry["phase"] = "RELATIVISTIC CORE BOUNCE"
                    self.telemetry["density"] = "1.6 × 10¹⁴ g/cm³"
                    self.telemetry["temp"] = "1.2 × 10¹¹ K"
                elif "iron" in cmd:
                    element_mode[None] = 2
                    self.telemetry["element"] = "Iron-56 Core (Degenerate)"
                elif "carbon" in cmd:
                    element_mode[None] = 1
                    self.telemetry["element"] = "Carbon-12 + Oxygen-16"
                elif "hydrogen" in cmd:
                    element_mode[None] = 0
                    self.telemetry["element"] = "Hydrogen-1 Envelope"
                elif "reset" in cmd:
                    initialize_star()
                    self.telemetry["phase"] = "HYDROSTATIC EQUILIBRIUM"

            except (sr.WaitTimeoutError, sr.UnknownValueError):
                pass
            except Exception:
                time.sleep(0.5)

    def vision_tracker_worker(self):
        """Optical tracking worker: extracts index pointer & pinch trigger."""
        cap = cv2.VideoCapture(0)
        mp_hands = mp.solutions.hands
        tracker = mp_hands.Hands(
            max_num_hands=1,
            min_detection_confidence=0.65,
            min_tracking_confidence=0.65
        )

        while self.is_alive and cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                continue

            frame = cv2.flip(frame, 1)
            h, w, _ = frame.shape
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = tracker.process(rgb)

            if results.multi_hand_landmarks:
                hand = results.multi_hand_landmarks[0]
                idx = hand.landmark[8]    # Tip of index finger
                thumb = hand.landmark[4]  # Tip of thumb

                # Map normalized coordinates (0..1) to simulation space (-1..1)
                self.hand_norm_x = (idx.x - 0.5) * 2.0
                self.hand_norm_y = -(idx.y - 0.5) * 2.0

                hand_force_pos[None] = ti.Vector([self.hand_norm_x, self.hand_norm_y, 0.0])
                hand_active[None] = 1

                # Calculate pinch distance (Thumb to Index) for core compression
                pinch_dist = math.hypot(idx.x - thumb.x, idx.y - thumb.y)
                if pinch_dist < 0.05 and is_collapsed[None] == 0:
                    is_collapsed[None] = 1
                    self.telemetry["phase"] = "CHANDRASEKHAR PINCH BREACH"

                # Draw Targeting Reticle
                cx, cy = int(idx.x * w), int(idx.y * h)
                cv2.circle(frame, (cx, cy), 14, (0, 240, 255), 2)
                cv2.line(frame, (cx - 20, cy), (cx + 20, cy), (0, 240, 255), 1)
                cv2.line(frame, (cx, cy - 20), (cx, cy + 20), (0, 240, 255), 1)
            else:
                hand_active[None] = 0

            # Display sci-fi HUD in camera view
            cv2.putText(frame, "OPTICAL INTERFEROMETER // SENSOR FEED", (12, 24),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 240, 255), 1)
            cv2.putText(frame, f"TARGET: ({self.hand_norm_x:.2f}, {self.hand_norm_y:.2f})",
                        (12, 44), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
            cv2.imshow("Observatory Video Feed", frame)

            if cv2.waitKey(1) & 0xFF == 27:  # ESC to close
                self.is_alive = False
                break

        cap.release()
        cv2.destroyAllWindows()


# -----------------------------------------------------------------------------
# 3. RUNTIME DISPATCH & TAICHI GGUI RENDER PIPELINE
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    print("[Observatory] Compiling Taichi GPU Kernels...")
    initialize_star()

    # Launch Antigravity Agent threads
    agent = AntigravityMultimodalAgent()
    threading.Thread(target=agent.voice_receptor_worker, daemon=True).start()
    threading.Thread(target=agent.vision_tracker_worker, daemon=True).start()

    # Modern High-Performance Taichi GGUI
    window = ti.ui.Window("DEEP SPACE CORE-COLLAPSE OBSERVATORY", (1400, 800), vsync=True)
    canvas = window.get_canvas()
    scene = ti.ui.Scene()
    camera = ti.ui.Camera()
    camera.position(0.0, 0.0, 2.4)
    camera.lookat(0.0, 0.0, 0.0)

    while window.running and agent.is_alive:
        # Step the GPU simulation kernel
        compute_physics_step()

        # Camera orbit control via mouse (hold Right Mouse Button to rotate/pan)
        camera.track_user_inputs(window, movement_speed=0.03, hold_key=ti.ui.RMB)
        scene.set_camera(camera)
        scene.ambient_light((0.12, 0.12, 0.18))
        scene.point_light(pos=(0, 0, 0), color=(1.0, 1.0, 1.0))

        # Render 150,000 GPU Particles
        scene.particles(pos, per_vertex_color=color, radius=0.0032)
        canvas.scene(scene)

        # Scientific HUD Telemetry Panel (Rendered directly in GPU Viewport)
        gui = window.get_gui()
        gui.begin("OBSERVATORY TELEMETRY", 0.02, 0.03, 0.34, 0.38)
        gui.text("MISSION CONTROL // DEEP-SPACE RELATIVISTIC DETECTOR")
        gui.text(f"SIMULATION PHASE: {agent.telemetry['phase']}")
        gui.text(f"CENTRAL DENSITY : {agent.telemetry['density']}")
        gui.text(f"CORE TEMPERATURE: {agent.telemetry['temp']}")
        gui.text(f"COMPOSITION     : {agent.telemetry['element']}")
        gui.text(f"VOCAL RECEPTOR  : {agent.telemetry['voice_status']}")
        gui.text(f"OPTICAL RETICLE : ({agent.hand_norm_x:.2f}, {agent.hand_norm_y:.2f})")
        
        gui.text("")
        gui.text("MANUAL OVERRIDE CONTROLS:")
        if gui.button("DETONATE CORE (SUPERNOVA)"):
            is_collapsed[None] = 1
            agent.telemetry["phase"] = "MANUAL OVERRIDE COLLAPSE"
        if gui.button("RESET TO PROGENITOR STAR"):
            initialize_star()
            agent.telemetry["phase"] = "HYDROSTATIC EQUILIBRIUM"
        gui.end()

        window.show()

    agent.is_alive = False
