/**
 * Space Simulation - Celestial Objects & Visual Builders
 * Constructs 3D meshes for Sun, Planets, Moons, Rings, Asteroid Belts, Orbit Trails, and Starfields.
 */

class CelestialBody {
  constructor(config) {
    this.name = config.name || 'Unknown Body';
    this.type = config.type || 'Planet'; // Star, Planet, Moon, Asteroid, Comet
    this.mass = config.mass || 10;
    this.radius = config.radius || 2;
    this.distance = config.distance || 0;
    this.orbitalSpeed = config.orbitalSpeed || 0;
    this.rotationSpeed = config.rotationSpeed || 0.01;
    this.angle = config.angle || Math.random() * Math.PI * 2;
    this.inclination = config.inclination || 0;
    this.color = config.color || 0x00f0ff;
    this.parent = config.parent || null;
    this.isSun = config.isSun || false;
    this.isFixed = config.isFixed || false;

    // Physical state vectors
    this.position = new THREE.Vector3(config.x || 0, config.y || 0, config.z || 0);
    this.velocity = new THREE.Vector3(config.vx || 0, config.vy || 0, config.vz || 0);
    this.acceleration = new THREE.Vector3(0, 0, 0);
    this.destroyed = false;

    // Descriptive metadata for telemetry HUD
    this.description = config.description || 'A celestial body orbiting in space.';
    this.temperature = config.temperature || 'N/A';
    this.period = config.period || 'N/A';

    // Three.js visual objects
    this.group = new THREE.Group();
    this.mesh = null;
    this.orbitLine = null;
    this.trailPoints = [];
    this.maxTrailPoints = 80;
    this.trailLine = null;

    this.initVisuals(config);
  }

  initVisuals(config) {
    // 1. Core Sphere Geometry
    const geometry = new THREE.SphereGeometry(this.radius, 32, 32);

    let material;
    if (this.isSun) {
      // Emissive Sun Material
      const sunTex = TextureGenerator.generateSunTexture();
      material = new THREE.MeshBasicMaterial({
        map: sunTex,
        color: 0xffffff
      });
    } else if (config.texture) {
      material = new THREE.MeshStandardMaterial({
        map: config.texture,
        roughness: 0.8,
        metalness: 0.1
      });
    } else {
      material = new THREE.MeshStandardMaterial({
        color: this.color,
        roughness: 0.7,
        metalness: 0.2
      });
    }

    this.mesh = new THREE.Mesh(geometry, material);
    this.group.add(this.mesh);

    // Sun Glow Corona
    if (this.isSun) {
      const glowGeo = new THREE.SphereGeometry(this.radius * 1.25, 32, 32);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 0.25,
        side: THREE.BackSide
      });
      const glowMesh = new THREE.Mesh(glowGeo, glowMat);
      this.group.add(glowMesh);
    }

    // Atmosphere Haze
    if (config.hasAtmosphere) {
      const atmosGeo = new THREE.SphereGeometry(this.radius * 1.05, 32, 32);
      const atmosMat = new THREE.MeshBasicMaterial({
        color: config.atmosphereColor || 0x00f0ff,
        transparent: true,
        opacity: 0.2,
        side: THREE.BackSide
      });
      const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
      this.group.add(atmosMesh);
    }

    // Earth Cloud Layer
    if (config.hasClouds) {
      const cloudTex = TextureGenerator.generateCloudsTexture();
      const cloudGeo = new THREE.SphereGeometry(this.radius * 1.02, 32, 32);
      const cloudMat = new THREE.MeshStandardMaterial({
        map: cloudTex,
        transparent: true,
        opacity: 0.6
      });
      this.cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
      this.group.add(this.cloudMesh);
    }

    // Rings (e.g. Saturn)
    if (config.hasRings) {
      const ringGeo = new THREE.RingGeometry(this.radius * 1.4, this.radius * 2.3, 64);
      // Fix UV mapping for Ring geometry
      const pos = ringGeo.attributes.position;
      const uv = ringGeo.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const u = (Math.atan2(y, x) + Math.PI) / (Math.PI * 2);
        const v = (Math.sqrt(x * x + y * y) - this.radius * 1.4) / (this.radius * 0.9);
        uv.setXY(i, u, v);
      }

      const ringTex = TextureGenerator.generateRingTexture();
      const ringMat = new THREE.MeshStandardMaterial({
        map: ringTex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2.2;
      this.group.add(ringMesh);
    }

    this.group.position.copy(this.position);
  }

  // Build Orbit Path Line for Keplerian mode
  createOrbitLine(scene) {
    if (!this.parent || this.distance === 0) return;

    const points = [];
    const segments = 128;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const x = Math.cos(theta) * this.distance;
      const z = Math.sin(theta) * this.distance;
      points.push(new THREE.Vector3(x, 0, z));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: this.color,
      transparent: true,
      opacity: 0.35,
      linewidth: 1
    });

    this.orbitLine = new THREE.LineLoop(geometry, material);
    if (this.parent) {
      this.parent.group.add(this.orbitLine);
    } else {
      scene.add(this.orbitLine);
    }
  }

  // Update visual position & rotate clouds
  updateVisuals() {
    this.group.position.copy(this.position);
    if (this.cloudMesh) {
      this.cloudMesh.rotation.y += 0.002;
    }
  }
}

/**
 * Procedural Space Features (Starfield & Asteroid Belts)
 */
const SpaceFeatures = {
  // Create 3D Starfield background
  createStarfield(count = 8000, radius = 1200) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const colorChoices = [
      new THREE.Color(0xffffff),
      new THREE.Color(0x9bb0ff),
      new THREE.Color(0xffcc66),
      new THREE.Color(0xff8866)
    ];

    for (let i = 0; i < count; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = radius * (0.8 + Math.random() * 0.4);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      const color = colorChoices[Math.floor(Math.random() * colorChoices.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 1.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.95
    });

    return new THREE.Points(geometry, material);
  },

  // Create Asteroid Belt particle system between minRadius and maxRadius
  createAsteroidBelt(count = 1500, minRadius = 140, maxRadius = 190) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = minRadius + Math.random() * (maxRadius - minRadius);
      const yOffset = (Math.random() - 0.5) * 8;

      positions[i * 3] = Math.cos(angle) * distance;
      positions[i * 3 + 1] = yOffset;
      positions[i * 3 + 2] = Math.sin(angle) * distance;

      const shade = 0.4 + Math.random() * 0.4;
      colors[i * 3] = shade;
      colors[i * 3 + 1] = shade * 0.9;
      colors[i * 3 + 2] = shade * 0.8;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 1.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.8
    });

    const beltMesh = new THREE.Points(geometry, material);
    beltMesh.userData = { minRadius, maxRadius, count };
    return beltMesh;
  }
};
