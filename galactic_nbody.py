import taichi as ti
import numpy as np
import cv2
import math
import time
import os
import csv

# -----------------------------------------------------------------------------
# 1. TAICHI GPU PHYSICS & PHOTOMETRIC RADIANCE ENGINE
# -----------------------------------------------------------------------------
ti.init(arch=ti.gpu, fast_math=True)

WIN_W, WIN_H = 1280, 720
NUM_STARS = 40_000
G = 1.35
SOFTENING = 0.045
DT = 0.0010

FOV_DEG = 52.0
FOV_TAN = math.tan(math.radians(FOV_DEG) * 0.5)

# Particle Fields
pos = ti.Vector.field(3, dtype=ti.f32, shape=NUM_STARS)
vel = ti.Vector.field(3, dtype=ti.f32, shape=NUM_STARS)
base_color = ti.Vector.field(3, dtype=ti.f32, shape=NUM_STARS)
active_color = ti.Vector.field(3, dtype=ti.f32, shape=NUM_STARS)
part_type = ti.field(dtype=ti.i32, shape=NUM_STARS)  # 0: Bulge, 1: Starburst, 2: Dust

# Screen-Space HDR Photometric Canvas & Fullscreen Console Canvas
hdr_canvas = ti.Vector.field(3, dtype=ti.f32, shape=(WIN_W, WIN_H))
display_canvas = ti.Vector.field(3, dtype=ti.f32, shape=(WIN_W, WIN_H))
console_canvas_field = ti.Vector.field(3, dtype=ti.f32, shape=(WIN_W, WIN_H))

# In-Engine Optical Sensor Overlay Buffer (Width: 340, Height: 255)
sensor_overlay = ti.Vector.field(3, dtype=ti.f32, shape=(340, 255))

# Supermassive Black Holes (SMBH)
smbh_pos = ti.Vector.field(3, dtype=ti.f32, shape=2)
smbh_vel = ti.Vector.field(3, dtype=ti.f32, shape=2)
smbh_mass = ti.field(dtype=ti.f32, shape=2)

# State Variables
sim_time_myr = ti.field(dtype=ti.f32, shape=())
core_distance = ti.field(dtype=ti.f32, shape=())
core_velocity = ti.field(dtype=ti.f32, shape=())
is_running = ti.field(dtype=ti.i32, shape=())

# Camera parameters
cam_pos = ti.Vector.field(3, dtype=ti.f32, shape=())
cam_lookat = ti.Vector.field(3, dtype=ti.f32, shape=())

# Controller & Diagnostic States
INPUT_MODE = "OPTICAL GESTURES"
manual_is_running = True

# Extended Dynamic Zoom Boundaries
MIN_CAM_RADIUS = 0.001
MAX_CAM_RADIUS = 500.0
cam_radius = 4.2
cam_angle = -1.1  # Azimuth / Yaw (Horizontal 360)
cam_pitch = 0.40  # Elevation / Pitch (Vertical: view from top / underneath)

# Toggle to display optical sensor feed within the main 3D simulation window
show_sensor_in_sim = True

# Adjustable Collision & Time Dilation Parameters
impact_vel = 0.85
angle_deg = 40.0
mass_ratio = 1.0
time_dilation = 1.0  # Time Dilation Warp Factor (0.1x to 5.0x)

composition_filter_mode = 0
COMPOSITION_NAMES = [
    "ALL COMPONENTS (COMPOSITE)",
    "NUCLEAR BULGE (OLD STARS)",
    "STARBURST ARMS (OB ASSOC.)",
    "INTERSTELLAR DUST LANES"
]

prev_distance = 0.0
radial_velocity_kpc_myr = 0.0
tidal_force_g = 0.0
periastron_reached = False
collision_phase = "1. INBOUND ORBITAL PLUNGE"
phase_detail = "Initial parabolic approach. Both disk structures remain dynamically intact."

# Persistent telemetry CSV logging
LOG_FILE_PATH = "merger_astrophysics_telemetry.csv"
log_header_initialized = False

# Surface Brightness Radial Profiler Fields (Logarithmic Bins)
NUM_BINS = 32
radial_bin_counts = ti.field(dtype=ti.i32, shape=NUM_BINS)


def initialize_telemetry_logger():
    global log_header_initialized
    with open(LOG_FILE_PATH, mode="w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "Timestamp_Epoch_s",
            "Sim_Time_Myr",
            "Core_Separation_kpc",
            "Relative_Velocity_kms",
            "Tidal_Strain_arb",
            "Collision_Phase",
            "Peak_Central_mu",
            "Effective_Radius_kpc"
        ])
    log_header_initialized = True
    print(f"[Telemetry Logger] Initialized persistent real-data sink: {LOG_FILE_PATH}")


def append_telemetry_entry(sim_t, dist, vel_mag, tidal, phase, mu_peak, r_eff):
    with open(LOG_FILE_PATH, mode="a", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            f"{time.time():.3f}",
            f"{sim_t:.2f}",
            f"{dist:.2f}",
            f"{vel_mag:.2f}",
            f"{tidal:.4f}",
            phase,
            f"{mu_peak:.2f}",
            f"{r_eff:.3f}"
        ])


@ti.kernel
def setup_realistic_galaxies(impact_v: ti.f32, angle_rad: ti.f32, m_ratio: ti.f32):
    sim_time_myr[None] = 0.0
    is_running[None] = 1

    smbh_mass[0] = 950.0
    smbh_mass[1] = 950.0 * m_ratio

    dist = 2.2
    smbh_pos[0] = ti.Vector([-dist * 0.5, -0.22, 0.0])
    smbh_pos[1] = ti.Vector([dist * 0.5, 0.22, 0.12])

    smbh_vel[0] = ti.Vector([impact_v * 0.45, 0.15, 0.0])
    smbh_vel[1] = ti.Vector([-impact_v * 0.45, -0.15 * ti.cos(angle_rad), -0.15 * ti.sin(angle_rad)])

    half = NUM_STARS // 2

    for i in range(NUM_STARS):
        g_idx = 0 if i < half else 1
        center = smbh_pos[g_idx]
        c_vel = smbh_vel[g_idx]
        central_m = smbh_mass[g_idx]

        p_type = 0
        rand_val = ti.random()
        if rand_val < 0.22:
            p_type = 0
        elif rand_val < 0.72:
            p_type = 1
        else:
            p_type = 2

        part_type[i] = p_type

        r = 0.0
        theta = 0.0
        z = 0.0

        if p_type == 0:
            r = 0.012 + 0.16 * (ti.random() ** 1.9)
            theta = ti.random() * 2.0 * math.pi
            z = (ti.random() - 0.5) * 0.075
        elif p_type == 1:
            arm_offset = 0.0 if ti.random() < 0.5 else math.pi
            r = 0.14 + 0.78 * (ti.random() ** 0.88)
            theta = ti.log(r / 0.14 + 1e-4) * 3.4 + arm_offset + (ti.random() - 0.5) * 0.32
            z = (ti.random() - 0.5) * 0.024
        else:
            arm_offset = 0.0 if ti.random() < 0.5 else math.pi
            r = 0.12 + 0.82 * (ti.random() ** 0.92)
            theta = ti.log(r / 0.12 + 1e-4) * 3.4 + arm_offset - 0.16 + (ti.random() - 0.5) * 0.18
            z = (ti.random() - 0.5) * 0.016

        v_circ = ti.sqrt(G * central_m / (r + 0.06))

        lx = r * ti.cos(theta)
        ly = r * ti.sin(theta)
        lz = z

        vx = 0.0
        vy = 0.0
        vz = 0.0

        col = ti.Vector([1.0, 1.0, 1.0])
        if g_idx == 1:
            ly_rot = ly * ti.cos(angle_rad) - lz * ti.sin(angle_rad)
            lz_rot = ly * ti.sin(angle_rad) + lz * ti.cos(angle_rad)
            lx = -lx
            ly = ly_rot
            lz = lz_rot

            vx = v_circ * ti.sin(theta)
            vy = v_circ * ti.cos(theta) * ti.cos(angle_rad)
            vz = v_circ * ti.cos(theta) * ti.sin(angle_rad)

            if p_type == 0:
                col = ti.Vector([1.4, 1.1, 0.75])
            elif p_type == 1:
                col = ti.Vector([0.35, 0.85, 1.6])
            else:
                col = ti.Vector([0.15, 0.08, 0.04])
        else:
            vx = -v_circ * ti.sin(theta)
            vy = v_circ * ti.cos(theta)
            vz = 0.0

            if p_type == 0:
                col = ti.Vector([1.5, 1.3, 0.9])
            elif p_type == 1:
                col = ti.Vector([0.4, 0.9, 1.7])
            else:
                col = ti.Vector([0.08, 0.12, 0.18])

        base_color[i] = col
        active_color[i] = col
        pos[i] = center + ti.Vector([lx, ly, lz])
        vel[i] = c_vel + ti.Vector([vx, vy, vz])


@ti.kernel
def update_composition_visibility(mode: ti.i32):
    for i in range(NUM_STARS):
        pt = part_type[i]
        orig_c = base_color[i]
        if mode == 0:
            active_color[i] = orig_c
        elif mode == 1:
            if pt == 0:
                active_color[i] = orig_c * 1.3
            else:
                active_color[i] = orig_c * 0.04
        elif mode == 2:
            if pt == 1:
                active_color[i] = orig_c * 1.4
            else:
                active_color[i] = orig_c * 0.04
        elif mode == 3:
            if pt == 2:
                active_color[i] = ti.Vector([0.95, 0.45, 0.15])
            else:
                active_color[i] = orig_c * 0.03


def dispatch_initialization(impact_v, angle_d, m_ratio):
    global prev_distance, periastron_reached, collision_phase, phase_detail
    angle_rad = math.radians(angle_d)
    prev_distance = 0.0
    periastron_reached = False
    collision_phase = "1. INBOUND ORBITAL PLUNGE"
    phase_detail = "Initial parabolic approach. Both disk structures remain dynamically intact."

    setup_realistic_galaxies(impact_v, angle_rad, m_ratio)
    update_composition_visibility(composition_filter_mode)


@ti.kernel
def compute_nbody_step(dilation: ti.f32):
    if is_running[None] == 1:
        dt_eff = DT * dilation
        sim_time_myr[None] += dt_eff * 18.0

        r_bh = smbh_pos[1] - smbh_pos[0]
        dist_bh = r_bh.norm() + SOFTENING
        core_distance[None] = dist_bh * 65.0
        core_velocity[None] = (smbh_vel[1] - smbh_vel[0]).norm() * 240.0

        force_bh = G * (smbh_mass[0] * smbh_mass[1]) / (dist_bh ** 3) * r_bh
        smbh_vel[0] += (force_bh / smbh_mass[0]) * dt_eff
        smbh_vel[1] += (-force_bh / smbh_mass[1]) * dt_eff

        smbh_pos[0] += smbh_vel[0] * dt_eff
        smbh_pos[1] += smbh_vel[1] * dt_eff

        for i in range(NUM_STARS):
            p = pos[i]
            d0 = smbh_pos[0] - p
            r0 = d0.norm() + SOFTENING
            acc = G * smbh_mass[0] / (r0 ** 3) * d0

            d1 = smbh_pos[1] - p
            r1 = d1.norm() + SOFTENING
            acc += G * smbh_mass[1] / (r1 ** 3) * d1

            vel[i] += acc * dt_eff
            pos[i] += vel[i] * dt_eff


@ti.kernel
def compute_surface_brightness_profile():
    for b in range(NUM_BINS):
        radial_bin_counts[b] = 0

    half = NUM_STARS // 2
    c0 = smbh_pos[0]

    for i in range(half):
        dist = (pos[i] - c0).norm()
        if 0.015 < dist < 1.5:
            log_r = ti.log(dist / 0.015) / ti.log(1.5 / 0.015)
            bin_idx = int(log_r * NUM_BINS)
            if 0 <= bin_idx < NUM_BINS:
                radial_bin_counts[bin_idx] += 1


# -----------------------------------------------------------------------------
# 2. SCREEN-SPACE ADDITIVE RADIANCE & VOLUMETRIC ASTRO-RENDERER
# -----------------------------------------------------------------------------
@ti.kernel
def render_photorealistic_galaxy(w: ti.i32, h: ti.i32):
    for x, y in hdr_canvas:
        hdr_canvas[x, y] = ti.Vector([0.0015, 0.0020, 0.0035])

    eye = cam_pos[None]
    look = cam_lookat[None]
    fwd = (look - eye).normalized()
    world_up = ti.Vector([0.0, 0.0, 1.0])

    right = fwd.cross(world_up)
    if right.norm() < 1e-4:
        right = ti.Vector([1.0, 0.0, 0.0])
    else:
        right = right.normalized()
    up = right.cross(fwd).normalized()

    aspect = float(w) / float(h)
    fov_tan = ti.f32(FOV_TAN)

    for i in range(NUM_STARS):
        p = pos[i]
        p_type = part_type[i]
        rel = p - eye

        z_cam = rel.dot(fwd)
        if z_cam > 0.001:
            x_cam = rel.dot(right)
            y_cam = rel.dot(up)

            u = (x_cam / (z_cam * fov_tan * aspect)) * 0.5 + 0.5
            v = (y_cam / (z_cam * fov_tan)) * 0.5 + 0.5

            px = int(u * float(w))
            py = int(v * float(h))

            if 3 <= px < w - 3 and 3 <= py < h - 3:
                col = active_color[i]

                if p_type == 0:
                    weight = 0.65 / (z_cam * 0.45 + 0.55)
                    for dx in range(-3, 4):
                        for dy in range(-3, 4):
                            r_sq = float(dx * dx + dy * dy)
                            if r_sq <= 9.0:
                                g_falloff = ti.exp(-r_sq * 0.65) * weight
                                ti.atomic_add(hdr_canvas[px + dx, py + dy], col * g_falloff)

                elif p_type == 1:
                    weight = 0.32 / (z_cam * 0.45 + 0.55)
                    for dx in range(-4, 5):
                        for dy in range(-4, 5):
                            r_sq = float(dx * dx + dy * dy)
                            if r_sq <= 16.0:
                                g_falloff = ti.exp(-r_sq * 0.28) * weight
                                ti.atomic_add(hdr_canvas[px + dx, py + dy], col * g_falloff)

                else:
                    for dx in range(-2, 3):
                        for dy in range(-2, 3):
                            hdr_canvas[px + dx, py + dy] *= 0.86

    for b in range(2):
        rel = smbh_pos[b] - eye
        z_cam = rel.dot(fwd)
        if z_cam > 0.001:
            x_cam = rel.dot(right)
            y_cam = rel.dot(up)
            u = (x_cam / (z_cam * fov_tan * aspect)) * 0.5 + 0.5
            v = (y_cam / (z_cam * fov_tan)) * 0.5 + 0.5
            px = int(u * float(w))
            py = int(v * float(h))

            if 8 <= px < w - 8 and 8 <= py < h - 8:
                for dx in range(-8, 9):
                    for dy in range(-8, 9):
                        r_sq = float(dx * dx + dy * dy)
                        if r_sq <= 64.0:
                            g_glow = ti.exp(-r_sq * 0.08) * 3.0
                            ti.atomic_add(hdr_canvas[px + dx, py + dy], ti.Vector([1.4, 1.3, 1.1]) * g_glow)

    for x, y in hdr_canvas:
        c = hdr_canvas[x, y]
        r = (c.x * (2.51 * c.x + 0.03)) / (c.x * (2.43 * c.x + 0.59) + 0.14)
        g = (c.y * (2.51 * c.y + 0.03)) / (c.y * (2.43 * c.y + 0.59) + 0.14)
        b = (c.z * (2.51 * c.z + 0.03)) / (c.z * (2.43 * c.z + 0.59) + 0.14)
        display_canvas[x, y] = ti.Vector([ti.min(1.0, r), ti.min(1.0, g), ti.min(1.0, b)])


# -----------------------------------------------------------------------------
# 2.1 ON-SCREEN COMPOSITING KERNELS
# -----------------------------------------------------------------------------
@ti.kernel
def composite_sensor_into_viewport():
    s_x0, s_y0 = 910, 80
    s_w, s_h = 340, 255
    border_col = ti.Vector([0.0, 0.94, 1.0])

    for i in range(s_w):
        for j in range(s_h):
            dx = s_x0 + i
            dy = s_y0 + j
            if dx < WIN_W and dy < WIN_H:
                if i < 2 or i >= s_w - 2 or j < 2 or j >= s_h - 2:
                    display_canvas[dx, dy] = border_col
                else:
                    display_canvas[dx, dy] = sensor_overlay[i, j]


@ti.kernel
def render_core_distance_scale(w: ti.i32, h: ti.i32):
    eye = cam_pos[None]
    look = cam_lookat[None]
    fwd = (look - eye).normalized()
    world_up = ti.Vector([0.0, 0.0, 1.0])
    right = fwd.cross(world_up)
    if right.norm() < 1e-4:
        right = ti.Vector([1.0, 0.0, 0.0])
    else:
        right = right.normalized()
    up = right.cross(fwd).normalized()

    aspect = float(w) / float(h)
    fov_tan = ti.f32(FOV_TAN)

    rel0 = smbh_pos[0] - eye
    rel1 = smbh_pos[1] - eye

    z0 = rel0.dot(fwd)
    z1 = rel1.dot(fwd)

    if z0 > 0.05 and z1 > 0.05:
        u0 = (rel0.dot(right) / (z0 * fov_tan * aspect)) * 0.5 + 0.5
        v0 = (rel0.dot(up) / (z0 * fov_tan)) * 0.5 + 0.5
        u1 = (rel1.dot(right) / (z1 * fov_tan * aspect)) * 0.5 + 0.5
        v1 = (rel1.dot(up) / (z1 * fov_tan)) * 0.5 + 0.5

        p0 = ti.Vector([u0 * float(w), v0 * float(h)])
        p1 = ti.Vector([u1 * float(w), v1 * float(h)])

        diff = p1 - p0
        line_len = diff.norm()
        if line_len > 1.0:
            dir_line = diff / line_len
            normal = ti.Vector([-dir_line.y, dir_line.x])

            line_steps = int(line_len * 1.5)
            line_col = ti.Vector([0.0, 0.95, 1.0])
            tick_col = ti.Vector([1.0, 0.90, 0.20])

            # Draw dashed gradient scale baseline connecting both cores
            for step in range(line_steps):
                t = float(step) / float(line_steps)
                pt = p0 + dir_line * (t * line_len)

                pattern = int(t * 50.0) % 2
                if pattern == 0:
                    for off in range(-1, 2):
                        px = int(pt.x + normal.x * float(off))
                        py = int(pt.y + normal.y * float(off))
                        if 0 <= px < w and 0 <= py < h:
                            display_canvas[px, py] = line_col

            # Transverse metric ticks across the gauge line (11 ticks)
            for tick in range(11):
                t_tick = float(tick) / 10.0
                tick_center = p0 + dir_line * (t_tick * line_len)
                tick_h = 10 if (tick == 0 or tick == 5 or tick == 10) else 5

                for tick_off in range(-tick_h, tick_h + 1):
                    px = int(tick_center.x + normal.x * float(tick_off))
                    py = int(tick_center.y + normal.y * float(tick_off))
                    if 0 <= px < w and 0 <= py < h:
                        display_canvas[px, py] = tick_col

            # Core anchor rings at both SMBH extremities
            for r in range(12, 15):
                for deg in range(32):
                    rad = float(deg) * (2.0 * math.pi / 32.0)
                    for extremity in range(2):
                        ep = p0 if extremity == 0 else p1
                        px = int(ep.x + float(r) * ti.cos(rad))
                        py = int(ep.y + float(r) * ti.sin(rad))
                        if 0 <= px < w and 0 <= py < h:
                            display_canvas[px, py] = tick_col


# -----------------------------------------------------------------------------
# 3. HIGH-PRECISION DUAL-ZONE OPTICAL SENSOR ENGINE
# -----------------------------------------------------------------------------
class HighPrecisionDualZoneSensor:
    def __init__(self):
        self.cap = cv2.VideoCapture(0)
        self.hand_state = "SEARCHING"
        self.rotational_delta = 0.0
        self.zoom_delta = 0.0
        self.rotation_label = "CENTER"
        self.zoom_label = "STATIC"
        self.last_restart_time = 0.0

        self.state_history = []
        self.smooth_rx = None
        self.smooth_ry = None
        self.latest_pip_frame = np.zeros((255, 340, 3), dtype=np.uint8)

    def process(self, is_active=True):
        if not self.cap.isOpened():
            return True, 0.0, 0.0, False

        ret, frame = self.cap.read()
        if not ret:
            return True, 0.0, 0.0, False

        frame = cv2.flip(frame, 1)
        h, w, _ = frame.shape
        mid_x = w // 2

        if not is_active:
            cv2.rectangle(frame, (0, 0), (w, h), (15, 15, 20), -1)
            cv2.putText(frame, "OPTICAL SENSOR: STANDBY", (int(w * 0.18), int(h * 0.44)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.65, (100, 100, 120), 2)
            cv2.putText(frame, "[MANUAL DESKTOP ACTIVE]", (int(w * 0.20), int(h * 0.54)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.52, (0, 240, 255), 1)
            self.latest_pip_frame = cv2.resize(frame, (340, 255))
            return True, 0.0, 0.0, False

        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        ycrcb = cv2.cvtColor(frame, cv2.COLOR_BGR2YCrCb)

        mask_hsv = cv2.inRange(hsv, np.array([0, 28, 50], dtype=np.uint8), np.array([25, 255, 255], dtype=np.uint8))
        mask_ycrcb = cv2.inRange(ycrcb, np.array([0, 133, 77], dtype=np.uint8),
                                 np.array([255, 173, 133], dtype=np.uint8))
        mask = cv2.bitwise_and(mask_hsv, mask_ycrcb)

        face_x1 = int(w * 0.25)
        face_x2 = int(w * 0.75)
        face_y2 = int(h * 0.50)
        mask[0:face_y2, face_x1:face_x2] = 0

        cv2.rectangle(frame, (face_x1, 0), (face_x2, face_y2), (255, 80, 0), 1)
        cv2.putText(frame, "SUPPRESSION CONE", (face_x1 + 6, 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.38, (255, 100, 0), 1)

        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
        mask = cv2.GaussianBlur(mask, (7, 7), 0)

        left_zone = frame[:, :mid_x]
        right_zone = frame[:, mid_x:]
        mask_left = mask[:, :mid_x]
        mask_right = mask[:, mid_x:]

        # ZONE 1: LEFT HAND
        contours_left, _ = cv2.findContours(mask_left, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        left_color = (120, 120, 120)
        restart_triggered = False

        reset_line_y = int(h * 0.25)
        cv2.line(left_zone, (0, reset_line_y), (mid_x, reset_line_y), (0, 240, 255), 1)
        cv2.putText(left_zone, "^ RAISE: RESTART ^", (8, reset_line_y - 6),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 240, 255), 1)

        if contours_left:
            c = max(contours_left, key=cv2.contourArea)
            area = cv2.contourArea(c)

            if area > 2800:
                hull_pts = cv2.convexHull(c, returnPoints=True)
                hull_indices = cv2.convexHull(c, returnPoints=False)
                hull_area = cv2.contourArea(hull_pts)
                solidity = float(area) / (hull_area + 1e-5)

                topmost = tuple(c[c[:, :, 1].argmin()][0])
                cv2.circle(left_zone, topmost, 6, (0, 240, 255), -1)
                cv2.drawContours(left_zone, [hull_pts], -1, (255, 200, 0), 1)

                now = time.time()
                if topmost[1] < reset_line_y:
                    if now - self.last_restart_time > 2.0:
                        self.hand_state = "RESTARTING"
                        left_color = (0, 240, 255)
                        restart_triggered = True
                        self.last_restart_time = now
                else:
                    defect_count = 0
                    if len(hull_indices) > 3:
                        defects = cv2.convexityDefects(c, hull_indices)
                        if defects is not None:
                            defects_reshaped = defects.reshape(-1, 4)
                            for s, e, f, d in defects_reshaped:
                                if d > 1200:
                                    defect_count += 1

                    raw_state = "OPEN PALM" if (solidity < 0.80 and defect_count >= 2) else "CLOSED FIST"
                    self.state_history.append(raw_state)
                    if len(self.state_history) > 4:
                        self.state_history.pop(0)

                    if self.state_history.count("CLOSED FIST") >= 3:
                        self.hand_state = "CLOSED FIST"
                        left_color = (0, 0, 255)
                    else:
                        self.hand_state = "OPEN PALM"
                        left_color = (0, 255, 0)
            else:
                self.hand_state = "NO HAND"
        else:
            self.hand_state = "NO HAND"

        # ZONE 2: RIGHT HAND
        contours_right, _ = cv2.findContours(mask_right, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        self.rotational_delta = 0.0
        self.zoom_delta = 0.0
        self.rotation_label = "CENTER"
        self.zoom_label = "STATIC"
        right_color = (120, 120, 120)

        zone_center_x = mid_x // 2
        zone_center_y = int(h * 0.62)

        if contours_right:
            c_r = max(contours_right, key=cv2.contourArea)
            area_r = cv2.contourArea(c_r)

            if area_r > 2600:
                m = cv2.moments(c_r)
                if m["m00"] != 0:
                    raw_cx = int(m["m10"] / m["m00"])
                    raw_cy = int(m["m01"] / m["m00"])

                    if self.smooth_rx is None:
                        self.smooth_rx = float(raw_cx)
                        self.smooth_ry = float(raw_cy)
                    else:
                        alpha = 0.32
                        self.smooth_rx = alpha * float(raw_cx) + (1.0 - alpha) * self.smooth_rx
                        self.smooth_ry = alpha * float(raw_cy) + (1.0 - alpha) * self.smooth_ry

                    cx = int(self.smooth_rx)
                    cy = int(self.smooth_ry)

                    offset_x = (cx - zone_center_x) / float(zone_center_x)
                    deadzone_x = 0.15
                    if abs(offset_x) > deadzone_x:
                        steer_magnitude = (abs(offset_x) - deadzone_x) / (1.0 - deadzone_x)
                        direction_x = 1.0 if offset_x > 0 else -1.0
                        self.rotational_delta = direction_x * (steer_magnitude ** 1.3) * 0.038
                        self.rotation_label = f"RIGHT ({int(steer_magnitude * 100)}%)" if direction_x > 0 else f"LEFT ({int(steer_magnitude * 100)}%)"
                        right_color = (0, 255, 255)
                    else:
                        self.rotational_delta = 0.0
                        self.rotation_label = "CENTER"

                    offset_y = (cy - zone_center_y) / float(h - zone_center_y)
                    deadzone_y = 0.15
                    if abs(offset_y) > deadzone_y:
                        zoom_mag = (abs(offset_y) - deadzone_y) / (1.0 - deadzone_y)
                        if offset_y < 0:
                            self.zoom_delta = -zoom_mag
                            self.zoom_label = f"IN ({int(zoom_mag * 100)}%)"
                        else:
                            self.zoom_delta = zoom_mag
                            self.zoom_label = f"OUT ({int(zoom_mag * 100)}%)"
                    else:
                        self.zoom_delta = 0.0
                        self.zoom_label = "STATIC"

                    cv2.circle(right_zone, (zone_center_x, zone_center_y), int(zone_center_x * deadzone_x),
                               (70, 70, 90), 1)
                    cv2.line(right_zone, (zone_center_x, 0), (zone_center_x, h), (40, 40, 60), 1)
                    cv2.line(right_zone, (0, zone_center_y), (mid_x, zone_center_y), (40, 40, 60), 1)
                    cv2.line(right_zone, (zone_center_x, zone_center_y), (cx, cy), right_color, 2)
                    cv2.circle(right_zone, (cx, cy), 9, right_color, -1)
            else:
                self.smooth_rx = None
                self.smooth_ry = None
        else:
            self.smooth_rx = None
            self.smooth_ry = None

        cv2.line(frame, (mid_x, 0), (mid_x, h), (70, 70, 90), 2)
        cv2.putText(frame, f"[L] {self.hand_state}", (10, 22),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.42, left_color, 1)
        cv2.putText(frame, f"[R] {self.rotation_label} | {self.zoom_label}", (mid_x + 10, 22),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.40, right_color, 1)

        self.latest_pip_frame = cv2.resize(frame, (340, 255))
        is_running_flag = (self.hand_state != "CLOSED FIST")
        return is_running_flag, self.rotational_delta, self.zoom_delta, restart_triggered

    def close(self):
        if self.cap.isOpened():
            self.cap.release()


# -----------------------------------------------------------------------------
# 4. OBSERVATIONAL SURFACE BRIGHTNESS PROFILER (CANVAS RENDERING)
# -----------------------------------------------------------------------------
def render_surface_brightness_study(bin_counts):
    win_w, win_h = 560, 310
    canvas = np.zeros((win_h, win_w, 3), dtype=np.uint8)
    canvas[:] = (248, 248, 248)

    px1 = int(win_w * 0.12)
    px2 = int(win_w * 0.94)
    py1 = int(win_h * 0.14)
    py2 = int(win_h * 0.82)

    cv2.rectangle(canvas, (px1, py1), (px2, py2), (40, 40, 40), 1)

    scale_font = 0.44
    cv2.putText(canvas, "Radius [pc]", (int((px1 + px2) * 0.42), max(18, py1 - 10)),
                cv2.FONT_HERSHEY_SIMPLEX, scale_font, (20, 20, 20), 1)

    top_ticks = [(px1 + int((px2 - px1) * f), label) for f, label in [
        (0.02, "1"), (0.25, "10"), (0.50, "100"), (0.75, "1000"), (0.96, "10k")
    ]]
    for tx, tlabel in top_ticks:
        cv2.line(canvas, (tx, py1), (tx, py1 + 4), (40, 40, 40), 1)
        cv2.putText(canvas, tlabel, (tx - 8, py1 - 5), cv2.FONT_HERSHEY_SIMPLEX, scale_font * 0.8, (50, 50, 50), 1)

    cv2.putText(canvas, "Radius [\"]", (int((px1 + px2) * 0.44), min(win_h - 6, py2 + 25)),
                cv2.FONT_HERSHEY_SIMPLEX, scale_font, (20, 20, 20), 1)

    bot_ticks = [(px1 + int((px2 - px1) * f), label) for f, label in [
        (0.02, "0.1"), (0.25, "1"), (0.50, "10"), (0.75, "100"), (0.96, "1k")
    ]]
    for bx, blabel in bot_ticks:
        cv2.line(canvas, (bx, py2), (bx, py2 - 4), (40, 40, 40), 1)
        cv2.putText(canvas, blabel, (bx - 10, py2 + 15), cv2.FONT_HERSHEY_SIMPLEX, scale_font * 0.8, (50, 50, 50), 1)

    cv2.putText(canvas, "mu(R)", (8, max(20, py1 - 10)),
                cv2.FONT_HERSHEY_SIMPLEX, scale_font * 0.9, (20, 20, 20), 1)

    y_ticks = [(py1 + int((py2 - py1) * f), label) for f, label in [
        (0.05, "14"), (0.28, "18"), (0.52, "22"), (0.76, "26"), (0.95, "30")
    ]]
    for ty, ylabel in y_ticks:
        cv2.line(canvas, (px1, ty), (px1 + 4, ty), (40, 40, 40), 1)
        cv2.putText(canvas, ylabel, (max(4, px1 - 24), ty + 4), cv2.FONT_HERSHEY_SIMPLEX, scale_font * 0.8,
                    (40, 40, 40), 1)

    dash_y = py1 + int((py2 - py1) * 0.45)
    for dx in range(px1, px2, 10):
        cv2.line(canvas, (dx, dash_y), (dx + 5, dash_y), (160, 160, 160), 1)

    points = []
    r_min_val = 0.015
    r_max_val = 1.5

    peak_mu = 32.0
    half_mass_count = NUM_STARS // 4
    accum_stars = 0
    r_eff = 0.0

    for b in range(NUM_BINS):
        count = bin_counts[b]
        accum_stars += count

        r_inner = r_min_val * ((r_max_val / r_min_val) ** (b / NUM_BINS))
        r_outer = r_min_val * ((r_max_val / r_min_val) ** ((b + 1) / NUM_BINS))
        area = math.pi * (r_outer ** 2 - r_inner ** 2)

        density = max(float(count) / (area + 1e-5), 1.0)
        mu = 32.0 - 2.5 * math.log10(density)
        mu = np.clip(mu, 12.0, 31.0)

        if b == 0:
            peak_mu = mu
        if accum_stars >= half_mass_count and r_eff == 0.0:
            r_eff = (r_inner + r_outer) * 0.5 * 30.0

        px = int(px1 + (b / float(NUM_BINS - 1)) * (px2 - px1))
        py = int(py1 + ((mu - 12.0) / (31.0 - 12.0)) * (py2 - py1))
        points.append((px, py))

    if len(points) > 1:
        for i in range(len(points) - 1):
            cv2.line(canvas, points[i], points[i + 1], (30, 30, 30), 2)
        for pt in points:
            cv2.circle(canvas, pt, 3, (30, 30, 30), -1)

    return peak_mu, r_eff, canvas


# -----------------------------------------------------------------------------
# 5. FULL-VIEWPORT OBSERVATORY CONSOLE RENDERER (TAB 2 VIEW)
# -----------------------------------------------------------------------------
def build_full_console_frame(sensor_frame, graph_canvas, sim_t, c_dist, c_vel, tidal, peak_mu, r_eff):
    cw, ch = WIN_W, WIN_H
    con = np.zeros((ch, cw, 3), dtype=np.uint8)
    con[:] = (18, 20, 25)

    cv2.rectangle(con, (0, 68), (cw, 118), (28, 32, 40), -1)
    cv2.putText(con, "DEEP-SPACE ASTROPHYSICS WORKSTATION // FULL OBSERVATORY CONSOLE", (25, 100),
                cv2.FONT_HERSHEY_SIMPLEX, 0.72, (0, 240, 255), 2)

    cv2.rectangle(con, (30, 130), (490, 460), (24, 28, 35), -1)
    cv2.rectangle(con, (30, 130), (490, 460), (55, 65, 80), 1)
    cv2.putText(con, "OPTICAL GESTURE SENSOR FEED", (45, 158), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (0, 240, 255), 1)

    s_resized = cv2.resize(sensor_frame, (430, 275))
    con[172:172 + 275, 45:45 + 430] = s_resized
    cv2.rectangle(con, (45, 172), (45 + 430, 172 + 275), (0, 240, 255), 1)

    cv2.rectangle(con, (515, 130), (cw - 30, 460), (24, 28, 35), -1)
    cv2.rectangle(con, (515, 130), (cw - 30, 460), (55, 65, 80), 1)
    cv2.putText(con, "SURFACE BRIGHTNESS PROFILE mu(R) [OBSERVATIONAL PHOTOMETRY]", (530, 158),
                cv2.FONT_HERSHEY_SIMPLEX, 0.52, (80, 200, 255), 1)

    g_resized = cv2.resize(graph_canvas, (700, 275))
    con[172:172 + 275, 530:530 + 700] = g_resized
    cv2.rectangle(con, (530, 172), (530 + 700, 172 + 275), (80, 180, 255), 1)

    # Core Separation Ruler & Scale Telemetry Bar
    cv2.rectangle(con, (30, 475), (cw - 30, 565), (28, 34, 44), -1)
    cv2.rectangle(con, (30, 475), (cw - 30, 565), (60, 75, 95), 1)
    cv2.putText(con, "REAL-TIME ASTROPHYSICAL TELEMETRY & SEPARATION SCALE", (45, 498), cv2.FONT_HERSHEY_SIMPLEX, 0.50,
                (0, 240, 255), 1)

    # Render a real-time scaled gauge bar representing core separation
    bar_x1, bar_x2, bar_y = 580, cw - 50, 496
    cv2.line(con, (bar_x1, bar_y), (bar_x2, bar_y), (80, 90, 110), 3)
    max_d_scale = 180.0
    bar_norm = np.clip(c_dist / max_d_scale, 0.0, 1.0)
    current_bar_x = int(bar_x1 + bar_norm * (bar_x2 - bar_x1))
    cv2.line(con, (bar_x1, bar_y), (current_bar_x, bar_y), (0, 240, 255), 3)
    cv2.circle(con, (current_bar_x, bar_y), 6, (255, 200, 0), -1)

    cv2.putText(con,
                f"Epoch: T+{sim_t:.1f} Myr    |    Core Separation: {c_dist:.2f} kpc    |    Relative Speed: {c_vel:.1f} km/s    |    Tidal Strain: {tidal:.2f} arb",
                (45, 524), cv2.FONT_HERSHEY_SIMPLEX, 0.44, (230, 230, 230), 1)
    cv2.putText(con,
                f"Central mu_0: {peak_mu:.2f} mag/arcsec^2    |    Half-Light Radius R_eff: {r_eff:.2f} kpc    |    Stage: >> {collision_phase} <<",
                (45, 550), cv2.FONT_HERSHEY_SIMPLEX, 0.44, (100, 240, 170), 1)

    cv2.rectangle(con, (30, 578), (cw - 30, ch - 12), (22, 25, 32), -1)
    cv2.rectangle(con, (30, 578), (cw - 30, ch - 12), (50, 55, 68), 1)
    cv2.putText(con, "ASTROPHYSICAL SCIENCE & DIAGNOSTIC THEORY:", (45, 600), cv2.FONT_HERSHEY_SIMPLEX, 0.46,
                (0, 240, 255), 1)

    cv2.putText(con,
                "• Surface Brightness mu(R) = -2.5*log10(Sigma(R)) + C measures intrinsic projected luminous flux per solid angle.",
                (45, 622), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (190, 195, 205), 1)
    cv2.putText(con,
                "• Core Separation Vector: Tracks Euclidean barycentric distance between SMBH attractors across dynamical flybys.",
                (45, 644), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (190, 195, 205), 1)
    cv2.putText(con,
                f"• Effective Half-Light Radius (R_eff) expands significantly during flybys due to strong tidal torque peeling stars into outer tails.",
                (45, 666), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (190, 195, 205), 1)
    cv2.putText(con, f"• Persistent Telemetry Sink: Logging live time-series data to '{LOG_FILE_PATH}'.",
                (45, 688), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (0, 200, 160), 1)

    rgb_con = cv2.cvtColor(con, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    transposed = np.transpose(rgb_con[::-1, :, :], (1, 0, 2))
    return transposed


# -----------------------------------------------------------------------------
# 6. RUNTIME DISPATCH & UNIFIED WORKSTATION
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    print("[Observatory] Booting Telescopic Deep-Sky Galactic Merger Observatory...")
    initialize_telemetry_logger()

    dispatch_initialization(impact_vel, angle_deg, mass_ratio)
    sensor = HighPrecisionDualZoneSensor()

    window = ti.ui.Window("DEEP SPACE GALACTIC MERGER OBSERVATORY", (WIN_W, WIN_H), vsync=True)
    canvas = window.get_canvas()

    last_profile_sample = time.time()
    last_mouse_x = None
    last_mouse_y = None

    active_browser_tab = 0

    latest_peak_mu = 32.0
    latest_r_eff = 0.0
    latest_peak_mu, latest_r_eff, latest_graph_canvas = render_surface_brightness_study(
        np.zeros(NUM_BINS, dtype=np.int32))

    while window.running:
        optical_active = (INPUT_MODE == "OPTICAL GESTURES")

        is_playing_sensor, rot_delta, zoom_delta, restart_triggered = sensor.process(is_active=optical_active)

        for event in window.get_events(ti.ui.PRESS):
            k = str(event.key).lower()
            if k in ('m', 'ti.ui.m'):
                if INPUT_MODE == "OPTICAL GESTURES":
                    INPUT_MODE = "MANUAL DESKTOP"
                    manual_is_running = (is_running[None] == 1)
                else:
                    INPUT_MODE = "OPTICAL GESTURES"

            elif k in ('c', 'ti.ui.c'):
                composition_filter_mode = (composition_filter_mode + 1) % 4
                update_composition_visibility(composition_filter_mode)

            elif event.key == ti.ui.SPACE or k in ('space', 'ti.ui.space'):
                if INPUT_MODE == "MANUAL DESKTOP":
                    manual_is_running = not manual_is_running
                else:
                    INPUT_MODE = "MANUAL DESKTOP"
                    manual_is_running = not (is_running[None] == 1)

            elif k in ('r', 'ti.ui.r'):
                dispatch_initialization(impact_vel, angle_deg, mass_ratio)

            elif k in ('1', 'ti.ui.1'):
                active_browser_tab = 0
            elif k in ('2', 'ti.ui.2'):
                active_browser_tab = 1

        rot_step_keyboard = 0.035
        pitch_step_keyboard = 0.035

        if active_browser_tab == 0:
            if INPUT_MODE == "MANUAL DESKTOP":
                is_running[None] = 1 if manual_is_running else 0

                if window.is_pressed(ti.ui.LMB):
                    curr_mx, curr_my = window.get_cursor_pos()
                    if curr_mx > 0.36 or curr_my > 0.94:
                        if last_mouse_x is not None and last_mouse_y is not None:
                            dx = curr_mx - last_mouse_x
                            dy = curr_my - last_mouse_y
                            cam_angle += dx * math.pi * 1.5
                            cam_pitch += dy * math.pi * 1.5
                        last_mouse_x = curr_mx
                        last_mouse_y = curr_my
                    else:
                        last_mouse_x = None
                        last_mouse_y = None
                else:
                    last_mouse_x = None
                    last_mouse_y = None

                if window.is_pressed(ti.ui.LEFT) or window.is_pressed('a') or window.is_pressed('A'):
                    cam_angle -= rot_step_keyboard
                if window.is_pressed(ti.ui.RIGHT) or window.is_pressed('d') or window.is_pressed('D'):
                    cam_angle += rot_step_keyboard

                if window.is_pressed(ti.ui.DOWN) or window.is_pressed('s') or window.is_pressed('S'):
                    cam_pitch -= pitch_step_keyboard
                if window.is_pressed(ti.ui.UP) or window.is_pressed('w') or window.is_pressed('W'):
                    cam_pitch += pitch_step_keyboard

                zoom_factor = 1.05
                if window.is_pressed('=') or window.is_pressed('+') or window.is_pressed('e') or window.is_pressed('E'):
                    cam_radius = max(MIN_CAM_RADIUS, min(MAX_CAM_RADIUS, cam_radius / zoom_factor))
                if window.is_pressed('-') or window.is_pressed('_') or window.is_pressed('q') or window.is_pressed('Q'):
                    cam_radius = max(MIN_CAM_RADIUS, min(MAX_CAM_RADIUS, cam_radius * zoom_factor))

            else:
                last_mouse_x = None
                last_mouse_y = None
                is_running[None] = 1 if is_playing_sensor else 0

                if restart_triggered:
                    dispatch_initialization(impact_vel, angle_deg, mass_ratio)

                if abs(rot_delta) > 0.0001:
                    cam_angle += rot_delta * 0.7

                if abs(zoom_delta) > 0.0001:
                    mult = (1.0 + 0.05 * abs(zoom_delta))
                    if zoom_delta < 0:
                        cam_radius = max(MIN_CAM_RADIUS, min(MAX_CAM_RADIUS, cam_radius / mult))
                    else:
                        cam_radius = max(MIN_CAM_RADIUS, min(MAX_CAM_RADIUS, cam_radius * mult))

        max_pitch = math.radians(85.0)
        cam_pitch = max(-max_pitch, min(max_pitch, cam_pitch))

        cam_angle = cam_angle % (2.0 * math.pi)

        eye_x = cam_radius * math.cos(cam_pitch) * math.sin(cam_angle)
        eye_y = -cam_radius * math.cos(cam_pitch) * math.cos(cam_angle)
        eye_z = cam_radius * math.sin(cam_pitch)

        cam_pos[None] = ti.Vector([eye_x, eye_y, eye_z])
        cam_lookat[None] = ti.Vector([0.0, 0.0, 0.0])

        for _ in range(4):
            compute_nbody_step(time_dilation)

        current_d = core_distance[None]
        if prev_distance == 0.0:
            prev_distance = current_d

        radial_velocity_kpc_myr = (current_d - prev_distance) / (DT * time_dilation * 18.0 * 4.0 + 1e-6)
        prev_distance = current_d

        d_clamped = max(current_d, 2.0)
        tidal_force_g = (G * 950.0 * (950.0 * mass_ratio)) / (d_clamped ** 2)

        if current_d < 18.0 and not periastron_reached:
            periastron_reached = True

        if not periastron_reached:
            collision_phase = "1. INBOUND ORBITAL PLUNGE"
            phase_detail = "Initial parabolic approach. Both disk structures remain dynamically intact."
        elif current_d < 22.0 and abs(radial_velocity_kpc_myr) < 120.0:
            collision_phase = "2. PERIGALACTICON PASSAGE (FLYBY)"
            phase_detail = "Cores at periastron. Maximum gravitational shear peeling stars into bridges."
        elif radial_velocity_kpc_myr > 40.0:
            collision_phase = "3. TIDAL TAIL EJECTION"
            phase_detail = "Post-periastron swing. Outer disk profile strips; central nuclear core remains dense."
        elif radial_velocity_kpc_myr < -30.0 and periastron_reached:
            collision_phase = "4. APOGALACTICON TURNAROUND"
            phase_detail = "Orbital apogee reached. Escape velocity not achieved; cores falling back."
        else:
            collision_phase = "5. COALESCENCE & RELAXATION"
            phase_detail = "Dynamical friction completes merger. Settling into elliptical Sérsic profile."

        now = time.time()
        if now - last_profile_sample > 0.08:
            compute_surface_brightness_profile()
            bin_data = radial_bin_counts.to_numpy()
            latest_peak_mu, latest_r_eff, latest_graph_canvas = render_surface_brightness_study(bin_data)

            append_telemetry_entry(
                sim_time_myr[None],
                current_d,
                core_velocity[None],
                tidal_force_g,
                collision_phase,
                latest_peak_mu,
                latest_r_eff
            )
            last_profile_sample = now

        # Convert webcam BGR frame into Taichi normalized float buffer
        pip_rgb = cv2.cvtColor(sensor.latest_pip_frame, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        pip_transposed = np.transpose(pip_rgb[::-1, :, :], (1, 0, 2))
        sensor_overlay.from_numpy(pip_transposed)

        # ---------------------------------------------------------------------
        # TAB-BASED VIEWPORT ROUTING
        # ---------------------------------------------------------------------
        if active_browser_tab == 0:
            render_photorealistic_galaxy(WIN_W, WIN_H)
            render_core_distance_scale(WIN_W, WIN_H)
            if show_sensor_in_sim and INPUT_MODE == "OPTICAL GESTURES":
                composite_sensor_into_viewport()
            canvas.set_image(display_canvas)
        else:
            console_frame = build_full_console_frame(
                sensor.latest_pip_frame,
                latest_graph_canvas,
                sim_time_myr[None],
                current_d,
                core_velocity[None],
                tidal_force_g,
                latest_peak_mu,
                latest_r_eff
            )
            console_canvas_field.from_numpy(console_frame)
            canvas.set_image(console_canvas_field)

        gui = window.get_gui()

        # ---------------------------------------------------------------------
        # TOP CHROME-STYLE TAB HEADER
        # ---------------------------------------------------------------------
        gui.begin("CHROME_STYLE_TAB_HEADER", 0.0, 0.0, 1.0, 0.065)

        tab1_label = "=== [ TAB 1: 3D SIMULATION VIEWPORT ] ===" if active_browser_tab == 0 else "    Tab 1: 3D Simulation Viewport    "
        tab2_label = "=== [ TAB 2: OBSERVATORY CONSOLE & TELEMETRY ] ===" if active_browser_tab == 1 else "    Tab 2: Observatory Console & Telemetry    "

        if gui.button(tab1_label):
            active_browser_tab = 0
        if gui.button(tab2_label):
            active_browser_tab = 1

        gui.end()

        # ---------------------------------------------------------------------
        # TAB 1: INTEGRATED SIMULATION & PARAMETER CONTROLS
        # ---------------------------------------------------------------------
        if active_browser_tab == 0:
            gui.begin("SIMULATION CONTROL DOCK", 0.015, 0.075, 0.34, 0.88)

            gui.text("SYSTEM STATUS & TIMELINE")
            gui.text("--------------------------------------------")
            gui.text(f"ACTIVE INPUT MODE : >> {INPUT_MODE} <<")
            status_txt = "RUNNING" if is_running[None] == 1 else "PAUSED"
            gui.text(f"TIMELINE STATUS   : {status_txt}")
            gui.text(f"WARP DILATION     : {time_dilation:.2f}x")
            gui.text(f"CORE SEPARATION   : {current_d:.2f} kpc")
            gui.text(f"CORE REL VELOCITY : {core_velocity[None]:.1f} km/s")
            gui.text(f"ZOOM RADIUS DIST  : {cam_radius:.3f} units")
            gui.text(f"CAMERA AZIMUTH    : {math.degrees(cam_angle):.1f}°")
            gui.text(f"CAMERA ELEVATION  : {math.degrees(cam_pitch):.1f}°")
            gui.text("--------------------------------------------")

            mode_btn_txt = "SWITCH TO MANUAL DESKTOP [KEY M]" if INPUT_MODE == "OPTICAL GESTURES" else "SWITCH TO WEBCAM GESTURES [KEY M]"
            if gui.button(mode_btn_txt):
                if INPUT_MODE == "OPTICAL GESTURES":
                    INPUT_MODE = "MANUAL DESKTOP"
                    manual_is_running = (is_running[None] == 1)
                else:
                    INPUT_MODE = "OPTICAL GESTURES"

            if INPUT_MODE == "MANUAL DESKTOP":
                play_btn_txt = "PAUSE TIMELINE (SPACE)" if manual_is_running else "RESUME TIMELINE (SPACE)"
                if gui.button(play_btn_txt):
                    manual_is_running = not manual_is_running

            gui.text("--------------------------------------------")
            gui.text("INTERACTIVE COLLISION PARAMETERS:")
            time_dilation = gui.slider_float("Time Dilation Factor", time_dilation, 0.1, 5.0)
            impact_vel = gui.slider_float("Impact Velocity (v_imp)", impact_vel, 0.1, 2.5)
            angle_deg = gui.slider_float("Inclination Angle (deg)", angle_deg, 0.0, 90.0)
            mass_ratio = gui.slider_float("Galaxy Mass Ratio (M2/M1)", mass_ratio, 0.1, 3.0)

            if gui.button("APPLY PARAMETERS & RESTART (KEY 'R')"):
                dispatch_initialization(impact_vel, angle_deg, mass_ratio)

            gui.text("--------------------------------------------")
            gui.text(f"COMPONENT FILTER: {COMPOSITION_NAMES[composition_filter_mode]}")
            if gui.button("CYCLE STELLAR COMPONENT [KEY 'C']"):
                composition_filter_mode = (composition_filter_mode + 1) % 4
                update_composition_visibility(composition_filter_mode)

            gui.text("--------------------------------------------")
            gui.text("NAVIGATION GUIDE:")
            gui.text("• Core Scale Line  : Visible between SMBHs")
            gui.text("• Orbit Left/Right : [LEFT]/[RIGHT] or [A]/[D]")
            gui.text("• Overhead/Under   : [UP]/[DOWN] or [W]/[S]")
            gui.text("• Zoom In / Out    : [E]/[Q] or [=]/[-]")
            gui.text("• Continuous Orbit : LMB Click & Drag")
            gui.text("• Switch Chrome Tab: Press [1] or [2]")

            gui.end()

            # Dynamic Floating Real-Time Core Separation Gauge Card in 3D View
            gui.begin("CORE DISTANCE GAUGE", 0.37, 0.075, 0.28, 0.12)
            gui.text(f"SEPARATION (D) : {current_d:.2f} kpc")
            gui.text(f"VELOCITY (V)   : {core_velocity[None]:.1f} km/s")
            gui.text(f"TIDAL STRAIN   : {tidal_force_g:.2f} arb. units")
            gui.end()

        # ---------------------------------------------------------------------
        # CAMERA CONTROL OVERLAY (IN SAME WINDOW, WITH VIEW TOGGLE)
        # ---------------------------------------------------------------------
        if INPUT_MODE == "OPTICAL GESTURES" and active_browser_tab == 0:
            gui.begin("OPTICAL CAMERA CONTROLLER", 0.69, 0.44, 0.29, 0.42)
            gui.text("DUAL-ZONE OPTICAL SENSOR HUD")
            gui.text("----------------------------------------")
            gui.text(f"LEFT HAND STATE  : {sensor.hand_state}")
            gui.text(f"ROTATION STEER   : {sensor.rotation_label}")
            gui.text(f"ZOOM CONTROLLER  : {sensor.zoom_label}")
            gui.text("----------------------------------------")

            pip_btn_txt = "HIDE SENSOR VIEW" if show_sensor_in_sim else "OPEN SENSOR IN THIS WINDOW"
            if gui.button(pip_btn_txt):
                show_sensor_in_sim = not show_sensor_in_sim

            gui.text("----------------------------------------")
            gui.text("GESTURE COMMAND MATRIX:")
            gui.text("• Left Open Palm   -> Resume Simulation")
            gui.text("• Left Closed Fist -> Pause Simulation")
            gui.text("• Raise Left Hand  -> Reset Simulation")
            gui.text("• Right Left/Right -> Orbit 360 Azimuth")
            gui.text("• Right Up/Down    -> Dynamic Zoom")
            gui.text("----------------------------------------")
            if gui.button("SWITCH TO DESKTOP KEYBOARD [KEY M]"):
                INPUT_MODE = "MANUAL DESKTOP"
                manual_is_running = (is_running[None] == 1)
            gui.end()

        window.show()

    sensor.close()