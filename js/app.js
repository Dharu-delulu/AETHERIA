/**
 * Space Simulation - Main Application Logic & Viewport Controller
 */

class SpaceSimulationApp {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.labelsContainer = document.getElementById('labels-container');
    
    // Scene, Camera, Renderer
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 10000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, logarithmicDepthBuffer: true });
    
    // Controls & Physics
    this.controls = null;
    this.physics = new PhysicsEngine();
    this.audio = new AudioEngine();
    
    // Simulation state
    this.bodies = [];
    this.selectedBody = null;
    this.isPaused = false;
    this.timeSpeed = 1.0;
    this.simTimeYears = 0.0;
    this.tourMode = false;
    this.tourTimer = 0;
    this.showOrbits = true;
    this.showLabels = true;

    // Raycaster for click selection
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Scene features
    this.sunLight = null;
    this.gridHelper = null;
    this.starfield = null;
    this.asteroidBelt = null;
    this.clock = new THREE.Clock();

    this.init();
  }

  init() {
    // 1. Renderer configuration
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.container.appendChild(this.renderer.domElement);

    // 2. Camera initial position
    this.camera.position.set(0, 150, 350);

    // 3. Orbit Controls
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxDistance = 2500;
    this.controls.minDistance = 2;

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0x333344, 1.2);
    this.scene.add(ambientLight);

    this.sunLight = new THREE.PointLight(0xffffff, 2.5, 4000, 0.5);
    this.sunLight.position.set(0, 0, 0);
    this.scene.add(this.sunLight);

    // 5. Grid Helper
    this.gridHelper = new THREE.GridHelper(1000, 50, 0x00f0ff, 0x112244);
    this.gridHelper.position.y = -20;
    this.gridHelper.visible = false;
    this.scene.add(this.gridHelper);

    // 6. Starfield Background
    this.starfield = SpaceFeatures.createStarfield();
    this.scene.add(this.starfield);

    // 7. Event Listeners & UI setup
    this.setupUI();
    window.addEventListener('resize', () => this.onWindowResize());
    this.renderer.domElement.addEventListener('click', (e) => this.onCanvasClick(e));

    // Global collision callback
    window.onBodyCollision = (survivor, absorbed) => {
      this.showToast(`💥 Collision: ${survivor.name} absorbed ${absorbed.name}!`);
      this.audio.playWarp();
    };

    // 8. Load default scenario
    this.loadScenario('solar');

    // 9. Start animation loop
    this.animate();
  }

  /**
   * Load Preset Scenarios
   */
  loadScenario(presetKey) {
    // Clear existing bodies & labels
    this.bodies.forEach(b => this.scene.remove(b.group));
    this.bodies = [];
    if (this.asteroidBelt) {
      this.scene.remove(this.asteroidBelt);
      this.asteroidBelt = null;
    }
    this.hideTelemetry();

    if (presetKey === 'solar') {
      this.physics.setMode('kepler');
      document.getElementById('toggle-nbody').checked = false;

      // Sun
      const sun = new CelestialBody({
        name: 'Sun',
        type: 'Star',
        radius: 14,
        mass: 1000,
        isSun: true,
        isFixed: true,
        temperature: '5,778 K',
        description: 'The star at the center of the Solar System, containing 99.86% of the system\'s mass.'
      });
      this.bodies.push(sun);

      // Mercury
      const mercury = new CelestialBody({
        name: 'Mercury',
        type: 'Terrestrial',
        radius: 1.2,
        distance: 30,
        orbitalSpeed: 4.7,
        rotationSpeed: 0.01,
        color: 0xa8a090,
        texture: TextureGenerator.generateMercuryTexture(),
        parent: sun,
        temperature: '167 °C',
        period: '88 Days',
        description: 'The smallest planet in the Solar System and closest to the Sun.'
      });

      // Venus
      const venus = new CelestialBody({
        name: 'Venus',
        type: 'Terrestrial',
        radius: 2.2,
        distance: 48,
        orbitalSpeed: 3.5,
        rotationSpeed: -0.004,
        hasAtmosphere: true,
        atmosphereColor: 0xffd700,
        texture: TextureGenerator.generateVenusTexture(),
        parent: sun,
        temperature: '464 °C',
        period: '225 Days',
        description: 'Second planet from the Sun, wrapped in thick toxic cloud atmosphere.'
      });

      // Earth
      const earth = new CelestialBody({
        name: 'Earth',
        type: 'Terrestrial',
        radius: 2.5,
        distance: 70,
        orbitalSpeed: 2.9,
        rotationSpeed: 0.02,
        hasAtmosphere: true,
        atmosphereColor: 0x00f0ff,
        hasClouds: true,
        texture: TextureGenerator.generateEarthTexture(),
        parent: sun,
        temperature: '15 °C',
        period: '365 Days',
        description: 'Home world of humanity, featuring liquid water oceans and abundant life.'
      });

      // Moon
      const moon = new CelestialBody({
        name: 'Moon',
        type: 'Moon',
        radius: 0.7,
        distance: 6,
        orbitalSpeed: 8.0,
        color: 0xcccccc,
        parent: earth,
        temperature: '-20 °C',
        period: '27 Days',
        description: 'Earth\'s sole natural satellite.'
      });

      // Mars
      const mars = new CelestialBody({
        name: 'Mars',
        type: 'Terrestrial',
        radius: 1.8,
        distance: 98,
        orbitalSpeed: 2.4,
        rotationSpeed: 0.018,
        hasAtmosphere: true,
        atmosphereColor: 0xff4422,
        texture: TextureGenerator.generateMarsTexture(),
        parent: sun,
        temperature: '-65 °C',
        period: '687 Days',
        description: 'The Red Planet, featuring dusty iron-oxide surface and extinct volcanoes.'
      });

      // Jupiter
      const jupiter = new CelestialBody({
        name: 'Jupiter',
        type: 'Gas Giant',
        radius: 6.5,
        distance: 145,
        orbitalSpeed: 1.3,
        rotationSpeed: 0.04,
        hasAtmosphere: true,
        atmosphereColor: 0xffaa44,
        texture: TextureGenerator.generateJupiterTexture(),
        parent: sun,
        temperature: '-110 °C',
        period: '12 Years',
        description: 'The largest planet in the Solar System, famous for its Great Red Spot.'
      });

      // Saturn
      const saturn = new CelestialBody({
        name: 'Saturn',
        type: 'Gas Giant',
        radius: 5.2,
        distance: 195,
        orbitalSpeed: 0.9,
        rotationSpeed: 0.038,
        hasRings: true,
        texture: TextureGenerator.generateSaturnTexture(),
        parent: sun,
        temperature: '-140 °C',
        period: '29 Years',
        description: 'Gas giant adorned with an extensive and bright planetary ring system.'
      });

      // Uranus
      const uranus = new CelestialBody({
        name: 'Uranus',
        type: 'Ice Giant',
        radius: 3.8,
        distance: 245,
        orbitalSpeed: 0.65,
        rotationSpeed: -0.025,
        texture: TextureGenerator.generateUranusTexture(),
        parent: sun,
        temperature: '-195 °C',
        period: '84 Years',
        description: 'Cyan ice giant orbiting with an extreme axial tilt of 98 degrees.'
      });

      // Neptune
      const neptune = new CelestialBody({
        name: 'Neptune',
        type: 'Ice Giant',
        radius: 3.6,
        distance: 290,
        orbitalSpeed: 0.54,
        rotationSpeed: 0.028,
        texture: TextureGenerator.generateNeptuneTexture(),
        parent: sun,
        temperature: '-200 °C',
        period: '165 Years',
        description: 'Deep blue ice giant experiencing the fastest winds in the Solar System.'
      });

      this.bodies.push(mercury, venus, earth, moon, mars, jupiter, saturn, uranus, neptune);

      // Asteroid Belt
      this.asteroidBelt = SpaceFeatures.createAsteroidBelt(1500, 110, 132);
      this.scene.add(this.asteroidBelt);

    } else if (presetKey === 'binary') {
      this.physics.setMode('n-body');
      document.getElementById('toggle-nbody').checked = true;

      const starA = new CelestialBody({
        name: 'Alpha Centauri A',
        type: 'Star',
        radius: 12,
        mass: 800,
        x: -40, z: 0,
        vx: 0, vz: 1.8,
        isSun: true,
        temperature: '5,790 K',
        description: 'Primary star in a tight binary orbit.'
      });

      const starB = new CelestialBody({
        name: 'Alpha Centauri B',
        type: 'Star',
        radius: 10,
        mass: 600,
        x: 40, z: 0,
        vx: 0, vz: -2.4,
        isSun: true,
        temperature: '5,260 K',
        description: 'Secondary companion star.'
      });

      const circumbinaryPlanet = new CelestialBody({
        name: 'Tatooine Prime',
        type: 'Terrestrial',
        radius: 3.0,
        mass: 5,
        x: 0, z: 180,
        vx: -3.2, vz: 0,
        color: 0x00f0ff,
        temperature: '28 °C',
        description: 'Circumbinary planet orbiting around both twin suns.'
      });

      this.bodies.push(starA, starB, circumbinaryPlanet);

    } else if (presetKey === 'chaos') {
      this.physics.setMode('n-body');
      document.getElementById('toggle-nbody').checked = true;

      const colors = [0xff3366, 0x00f0ff, 0xffb700, 0x9933ff, 0x33ff99];
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const dist = 70 + Math.random() * 60;
        const b = new CelestialBody({
          name: `Mass Body ${i + 1}`,
          type: 'Heavy Core',
          radius: 3.5 + Math.random() * 3,
          mass: 80 + Math.random() * 120,
          x: Math.cos(angle) * dist,
          z: Math.sin(angle) * dist,
          vx: -Math.sin(angle) * 2.2 + (Math.random() - 0.5),
          vz: Math.cos(angle) * 2.2 + (Math.random() - 0.5),
          color: colors[i % colors.length],
          description: 'Gravitationally unstable body in chaotic n-body interaction.'
        });
        this.bodies.push(b);
      }

    } else if (presetKey === 'comet') {
      this.physics.setMode('kepler');
      document.getElementById('toggle-nbody').checked = false;

      const sun = new CelestialBody({
        name: 'Sun',
        type: 'Star',
        radius: 14,
        mass: 1000,
        isSun: true,
        isFixed: true,
        temperature: '5,778 K',
        description: 'Solar anchor for comet trajectory.'
      });

      const earth = new CelestialBody({
        name: 'Earth',
        type: 'Terrestrial',
        radius: 2.5,
        distance: 70,
        orbitalSpeed: 2.9,
        texture: TextureGenerator.generateEarthTexture(),
        parent: sun
      });

      const comet = new CelestialBody({
        name: 'Halley\'s Comet',
        type: 'Comet',
        radius: 1.5,
        distance: 160,
        orbitalSpeed: 3.8,
        color: 0x99ffff,
        parent: sun,
        temperature: '-120 °C',
        period: '75 Years',
        description: 'Highly elliptical icy body producing glowing ion trail when nearing perihelion.'
      });

      this.bodies.push(sun, earth, comet);
      this.asteroidBelt = SpaceFeatures.createAsteroidBelt(2000, 100, 140);
      this.scene.add(this.asteroidBelt);
    }

    // Add visual groups & orbit lines
    this.bodies.forEach(b => {
      this.scene.add(b.group);
      b.createOrbitLine(this.scene);
    });

    this.showToast(`Loaded scenario: ${presetKey.toUpperCase()}`);
    this.audio.playWarp();
  }

  /**
   * Main Animation Loop
   */
  animate() {
    requestAnimationFrame(() => this.animate());

    const dt = Math.min(this.clock.getDelta(), 0.1);

    if (!this.isPaused) {
      this.simTimeYears += dt * this.timeSpeed * 0.1;
      document.getElementById('sim-clock').innerText = `Year: ${this.simTimeYears.toFixed(2)}`;

      // Update Physics
      this.physics.update(this.bodies, dt, this.timeSpeed);

      // Clean up destroyed bodies
      for (let i = this.bodies.length - 1; i >= 0; i--) {
        if (this.bodies[i].destroyed) {
          this.scene.remove(this.bodies[i].group);
          if (this.bodies[i].orbitLine) {
            this.scene.remove(this.bodies[i].orbitLine);
          }
          this.bodies.splice(i, 1);
        }
      }

      // Update visual meshes
      this.bodies.forEach(b => b.updateVisuals());

      // Rotate Asteroid Belt
      if (this.asteroidBelt) {
        this.asteroidBelt.rotation.y += 0.0003 * this.timeSpeed;
      }
    }

    // Camera Focus Tracking
    if (this.selectedBody && !this.selectedBody.destroyed) {
      if (this.controls.target) {
        this.controls.target.lerp(this.selectedBody.position, 0.05);
      }
      this.updateTelemetryData(this.selectedBody);
    }

    // Cinematic Tour Mode
    if (this.tourMode) {
      this.tourTimer += dt;
      if (this.tourTimer > 6.0) {
        this.tourTimer = 0;
        const index = Math.floor(Math.random() * this.bodies.length);
        this.selectBody(this.bodies[index]);
      }
    }

    // Orbit Controls Update
    this.controls.update();

    // Render 2D Screen Space Labels
    this.update2DLabels();

    // Render 3D Scene
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Screen Space 2D Overlay Labels
   */
  update2DLabels() {
    this.labelsContainer.innerHTML = '';
    if (!this.showLabels) return;

    const tempV = new THREE.Vector3();
    this.bodies.forEach(body => {
      if (body.destroyed) return;

      body.group.getWorldPosition(tempV);
      // Project 3D coordinate to normalized device coordinates (-1 to +1)
      tempV.project(this.camera);

      // Check if behind camera
      if (tempV.z > 1.0) return;

      const x = (tempV.x * 0.5 + 0.5) * window.innerWidth;
      const y = (tempV.y * -0.5 + 0.5) * window.innerHeight;

      const label = document.createElement('div');
      label.className = 'planet-label-2d';
      label.style.left = `${x}px`;
      label.style.top = `${y - 12}px`;
      label.innerText = body.name;

      if (this.selectedBody === body) {
        label.style.color = 'var(--accent-cyan)';
        label.style.fontSize = '13px';
      }

      this.labelsContainer.appendChild(label);
    });
  }

  /**
   * Raycasting & Selection Logic
   */
  onCanvasClick(event) {
    this.audio.playClick();

    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const meshes = [];
    this.bodies.forEach(b => {
      b.group.traverse(child => {
        if (child.isMesh) {
          child.userData.parentBody = b;
          meshes.push(child);
        }
      });
    });

    const intersects = this.raycaster.intersectObjects(meshes);
    if (intersects.length > 0) {
      const clickedBody = intersects[0].object.userData.parentBody;
      if (clickedBody) {
        this.selectBody(clickedBody);
      }
    }
  }

  selectBody(body) {
    this.selectedBody = body;
    this.showTelemetry(body);

    // Smooth camera focus zoom
    const targetPos = body.position.clone();
    const offset = new THREE.Vector3(0, body.radius * 3 + 10, body.radius * 4 + 25);
    
    // Animate camera position
    const startPos = this.camera.position.clone();
    const endPos = targetPos.clone().add(offset);

    let progress = 0;
    const animateCam = () => {
      progress += 0.05;
      if (progress <= 1.0) {
        this.camera.position.lerpVectors(startPos, endPos, progress);
        this.controls.target.lerpVectors(this.controls.target, targetPos, progress);
        requestAnimationFrame(animateCam);
      }
    };
    animateCam();
  }

  /**
   * UI Event Bindings
   */
  setupUI() {
    // Preset dropdown
    document.getElementById('preset-select').addEventListener('change', (e) => {
      this.loadScenario(e.target.value);
    });

    // Play/Pause
    const btnPlay = document.getElementById('btn-play-pause');
    btnPlay.addEventListener('click', () => {
      this.isPaused = !this.isPaused;
      btnPlay.innerHTML = this.isPaused ? '▶ Play' : '⏸ Pause';
      this.audio.playClick();
    });

    // Reset Time
    document.getElementById('btn-reset-time').addEventListener('click', () => {
      this.simTimeYears = 0;
      this.audio.playClick();
    });

    // Time Speed Slider
    const sliderSpeed = document.getElementById('slider-speed');
    sliderSpeed.addEventListener('input', (e) => {
      this.timeSpeed = parseFloat(e.target.value);
      document.getElementById('speed-label').innerText = `${this.timeSpeed.toFixed(1)}x`;
    });

    // Toggles
    document.getElementById('toggle-orbits').addEventListener('change', (e) => {
      this.showOrbits = e.target.checked;
      this.bodies.forEach(b => {
        if (b.orbitLine) b.orbitLine.visible = this.showOrbits;
      });
    });

    document.getElementById('toggle-labels').addEventListener('change', (e) => {
      this.showLabels = e.target.checked;
    });

    document.getElementById('toggle-grid').addEventListener('change', (e) => {
      this.gridHelper.visible = e.target.checked;
    });

    document.getElementById('toggle-audio').addEventListener('change', (e) => {
      this.audio.toggleAmbient(e.target.checked);
    });

    document.getElementById('toggle-nbody').addEventListener('change', (e) => {
      this.physics.setMode(e.target.checked ? 'n-body' : 'kepler');
      this.showToast(`Physics Mode: ${e.target.checked ? 'N-Body Gravity' : 'Kepler Orbits'}`);
    });

    // Telemetry Panel Actions
    document.getElementById('btn-close-telemetry').addEventListener('click', () => {
      this.hideTelemetry();
    });

    document.getElementById('btn-focus-body').addEventListener('click', () => {
      if (this.selectedBody) this.selectBody(this.selectedBody);
    });

    document.getElementById('btn-destroy-body').addEventListener('click', () => {
      if (this.selectedBody) {
        this.selectedBody.destroyed = true;
        this.hideTelemetry();
        this.showToast(`Destroyed body ${this.selectedBody.name}`);
        this.audio.playWarp();
      }
    });

    // Tour Mode
    const btnTour = document.getElementById('btn-tour');
    btnTour.addEventListener('click', () => {
      this.tourMode = !this.tourMode;
      btnTour.classList.toggle('btn-primary', this.tourMode);
      btnTour.innerText = this.tourMode ? '🎬 Exit Tour' : '🎬 Tour Mode';
      this.showToast(this.tourMode ? 'Entered Solar System Tour' : 'Exited Tour Mode');
    });

    // Spawn Custom Body Modal
    const modal = document.getElementById('modal-spawn');
    document.getElementById('btn-spawn-modal').addEventListener('click', () => {
      modal.classList.add('active');
    });
    document.getElementById('btn-close-modal').addEventListener('click', () => {
      modal.classList.remove('active');
    });
    document.getElementById('btn-cancel-spawn').addEventListener('click', () => {
      modal.classList.remove('active');
    });

    document.getElementById('btn-confirm-spawn').addEventListener('click', () => {
      this.spawnCustomBody();
      modal.classList.remove('active');
    });
  }

  spawnCustomBody() {
    const name = document.getElementById('input-name').value || 'Custom Body';
    const type = document.getElementById('input-type').value;
    const distance = parseFloat(document.getElementById('input-distance').value) || 120;
    const radius = parseFloat(document.getElementById('input-radius').value) || 3;
    const mass = parseFloat(document.getElementById('input-mass').value) || 10;
    const colorHex = document.getElementById('input-color').value || '#00f0ff';
    const color = parseInt(colorHex.replace('#', '0x'));

    const sun = this.bodies.find(b => b.isSun) || this.bodies[0];
    const speed = this.physics.calculateOrbitalVelocity(sun ? sun.mass : 1000, distance);

    const newBody = new CelestialBody({
      name,
      type,
      radius,
      mass,
      distance,
      orbitalSpeed: speed,
      color,
      parent: sun,
      temperature: 'Unknown',
      period: 'Calculated',
      description: `User-spawned custom ${type} orbiting at distance ${distance}.`
    });

    this.bodies.push(newBody);
    this.scene.add(newBody.group);
    newBody.createOrbitLine(this.scene);

    this.selectBody(newBody);
    this.showToast(`Spawned custom body: ${name}`);
    this.audio.playWarp();
  }

  showTelemetry(body) {
    const panel = document.getElementById('telemetry-panel');
    panel.classList.remove('hidden');
    this.updateTelemetryData(body);
  }

  updateTelemetryData(body) {
    document.getElementById('telemetry-name').innerText = body.name;
    document.getElementById('stat-type').innerText = body.type;
    document.getElementById('stat-mass').innerText = `${body.mass.toFixed(1)} M`;
    document.getElementById('stat-velocity').innerText = `${(body.velocity.length() * 10).toFixed(1)} km/s`;
    document.getElementById('stat-distance').innerText = body.parent ? `${(body.distance / 70).toFixed(2)} AU` : '0 AU';
    document.getElementById('stat-temp').innerText = body.temperature;
    document.getElementById('stat-period').innerText = body.period;
    document.getElementById('telemetry-desc').innerText = body.description;
  }

  hideTelemetry() {
    document.getElementById('telemetry-panel').classList.add('hidden');
    this.selectedBody = null;
  }

  showToast(text) {
    const toast = document.getElementById('toast');
    toast.innerText = text;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

// Instantiate application when DOM loaded
window.addEventListener('DOMContentLoaded', () => {
  window.app = new SpaceSimulationApp();
});
