/**
 * Space Simulation - Physics & Orbital Mechanics Engine
 * Manages Keplerian orbits and real-time N-Body Newtonian gravitational dynamics
 */

class PhysicsEngine {
  constructor() {
    this.G = 0.8; // Normalized gravitational constant for simulation scale
    this.mode = 'kepler'; // 'kepler' or 'n-body'
    this.softening = 2.0; // Softening parameter to prevent division by zero / extreme slingshots
  }

  setMode(mode) {
    this.mode = mode;
  }

  /**
   * Update all bodies in the scene based on simulation time delta dt
   */
  update(bodies, dt, timeSpeed) {
    const effectiveDt = dt * timeSpeed;

    if (this.mode === 'kepler') {
      this.updateKepler(bodies, effectiveDt);
    } else if (this.mode === 'n-body') {
      this.updateNBody(bodies, effectiveDt);
    }

    // Check collisions
    this.handleCollisions(bodies);
  }

  /**
   * Keplerian Orbital Mechanics Update
   */
  updateKepler(bodies, dt) {
    bodies.forEach(body => {
      if (body.isSun || body.isFixed) return;

      if (body.parent) {
        // Calculate orbit position relative to parent body
        body.angle += (body.orbitalSpeed * dt) / Math.max(1, body.distance);

        const x = body.parent.position.x + Math.cos(body.angle) * body.distance;
        const z = body.parent.position.z + Math.sin(body.angle) * body.distance;

        // Optional inclination (y-axis offset)
        const y = body.parent.position.y + Math.sin(body.angle * 2) * (body.inclination || 0);

        // Compute current velocity vector for HUD display
        body.velocity.set(
          -Math.sin(body.angle) * body.orbitalSpeed,
          0,
          Math.cos(body.angle) * body.orbitalSpeed
        );

        body.position.set(x, y, z);
      } else {
        // Body moving freely in space
        body.position.addScaledVector(body.velocity, dt);
      }

      // Self rotation on axis
      if (body.rotationSpeed) {
        body.mesh.rotation.y += body.rotationSpeed * dt;
      }
    });
  }

  /**
   * Full N-Body Newtonian Gravity Mechanics Update (Verlet Integration)
   */
  updateNBody(bodies, dt) {
    // 1. Reset accelerations
    bodies.forEach(b => b.acceleration.set(0, 0, 0));

    // 2. Compute pairwise gravitational forces
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const b1 = bodies[i];
        const b2 = bodies[j];

        const diff = new THREE.Vector3().subVectors(b2.position, b1.position);
        const distSq = diff.lengthSq() + this.softening;
        const dist = Math.sqrt(distSq);

        if (dist === 0) continue;

        // Force magnitude = G * m1 * m2 / r^2
        const forceMag = (this.G * b1.mass * b2.mass) / distSq;
        const forceDir = diff.normalize();

        // Acceleration = Force / mass
        if (!b1.isFixed) {
          b1.acceleration.addScaledVector(forceDir, forceMag / b1.mass);
        }
        if (!b2.isFixed) {
          b2.acceleration.addScaledVector(forceDir, -forceMag / b2.mass);
        }
      }
    }

    // 3. Update velocity and position
    bodies.forEach(body => {
      if (body.isFixed) return;

      body.velocity.addScaledVector(body.acceleration, dt);
      body.position.addScaledVector(body.velocity, dt);

      if (body.rotationSpeed) {
        body.mesh.rotation.y += body.rotationSpeed * dt;
      }
    });
  }

  /**
   * Collision detection and merger handling
   */
  handleCollisions(bodies) {
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const b1 = bodies[i];
        const b2 = bodies[j];

        if (b1.destroyed || b2.destroyed) continue;

        const dist = b1.position.distanceTo(b2.position);
        const minDist = b1.radius + b2.radius;

        if (dist < minDist * 0.8) {
          // Determine survivor (larger mass absorbs smaller body)
          const survivor = b1.mass >= b2.mass ? b1 : b2;
          const absorbed = b1.mass >= b2.mass ? b2 : b1;

          // Conservation of momentum in N-body mode
          if (this.mode === 'n-body') {
            const totalMass = survivor.mass + absorbed.mass;
            survivor.velocity.set(
              (survivor.velocity.x * survivor.mass + absorbed.velocity.x * absorbed.mass) / totalMass,
              (survivor.velocity.y * survivor.mass + absorbed.velocity.y * absorbed.mass) / totalMass,
              (survivor.velocity.z * survivor.mass + absorbed.velocity.z * absorbed.mass) / totalMass
            );
            survivor.mass = totalMass;
          }

          absorbed.destroyed = true;

          // Trigger collision visual callback if available
          if (window.onBodyCollision) {
            window.onBodyCollision(survivor, absorbed);
          }
        }
      }
    }
  }

  /**
   * Calculate orbital speed for circular orbit at distance r from central mass M
   */
  calculateOrbitalVelocity(centralMass, distance) {
    return Math.sqrt((this.G * centralMass) / distance);
  }
}
