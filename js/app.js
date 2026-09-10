/**
 * SUPERNOVA LAB - Main WebGL & Application Controller
 * Three.js 3D viewport, astrophysics simulation state machine,
 * particle ejecta engine, shockwave FX, and interactive HUD manager.
 */

class SupernovaLabApp {
  constructor() {
    this.container = document.getElementById('canvas-container');
    
    // Three.js Core
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 10000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, logarithmicDepthBuffer: true });
    this.controls = null;

    // Audio & Physics
    this.audio = new AudioEngine();
    
    // Application State
    this.activeTab = 'explore';
    this.currentMode = 'scientific'; // 'scientific' or 'creative'
    this.currentStage = 0; // 0: Star Life, 1: Core Fusion, 2: Collapse, 3: Explosion, 4: Remnant, 5: Enrichment
    this.isPaused = false;
    this.timeSpeed = 1.0;
    this.simTime = 0.0;

    // Current Star Analysis Data
    this.starData = null;
    this.currentParams = {
      mass: 20,
      temperature: 35000,
      rotation: 40,
      metallicity: 1.0,
      isBinary: false,
      companionMass: 5.0
    };

    // 3D Objects References
    this.starMesh = null;
    this.coronaMesh = null;
    this.companionMesh = null;
    this.coreCutawayGroup = null;
    this.ejectaParticles = null;
    this.ejectaVelocities = [];
    this.ejectaColors = [];
    this.shockwaveMesh = null;
    this.remnantMesh = null;
    this.pulsarBeamMesh = null;
    this.starfield = null;

    // "What If?" Experiment Slots
    this.slotAData = null;
    this.slotBData = null;

    // Prediction Game State
    this.randomStarParams = null;
    this.selectedPrediction = null;

    this.init();
  }

  init() {
    // 1. Renderer Setup
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    this.container.appendChild(this.renderer.domElement);

    // 2. Camera Setup
    this.camera.position.set(0, 40, 180);

    // 3. Orbit Controls
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxDistance = 1500;
    this.controls.minDistance = 5;

    // 4. Lighting
    const ambient = new THREE.AmbientLight(0x223344, 1.5);
    this.scene.add(ambient);

    const pointLight = new THREE.PointLight(0xffffff, 3.0, 3000);
    pointLight.position.set(0, 0, 0);
    this.scene.add(pointLight);

    // 5. Starfield Background
    this.createStarfield();

    // 6. Event Listeners & UI Binding
    this.setupUIEvents();
    window.addEventListener('resize', () => this.onWindowResize());

    // 7. Load Default Object (Cassiopeia A in Explore Mode)
    this.loadRealSupernova('casa');

    // 8. Start Animation Loop
    this.animate();
  }

  /**
   * Create Deep Space Starfield Background
   */
  createStarfield() {
    const count = 4000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const radius = 800 + Math.random() * 1200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      colors[i * 3] = 0.7 + Math.random() * 0.3;
      colors[i * 3 + 1] = 0.8 + Math.random() * 0.2;
      colors[i * 3 + 2] = 1.0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 1.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.8
    });

    this.starfield = new THREE.Points(geometry, material);
    this.scene.add(this.starfield);
  }

  /**
   * Build / Rebuild 3D Star System based on Astrophysics Analysis
   */
  buildStarSystem(params) {
    this.clear3DScene();
    this.starData = AstrophysicsEngine.analyzeStar(params);

    const baseRadius = Math.max(6, Math.min(35, Math.log2(this.starData.radius + 1) * 6));
    const starColor = this.getStarColorHex(this.starData.temperature);

    // 1. Progenitor Star Sphere
    const geom = new THREE.SphereGeometry(baseRadius, 64, 64);
    const starTex = TextureGenerator.generateStarTexture(starColor, this.starData.temperature);
    const mat = new THREE.MeshStandardMaterial({
      map: starTex,
      emissive: new THREE.Color(starColor),
      emissiveIntensity: 0.8,
      roughness: 0.4
    });

    this.starMesh = new THREE.Mesh(geom, mat);
    this.scene.add(this.starMesh);

    // 2. Coronal Aura Outer Glow Mesh
    const coronaGeom = new THREE.SphereGeometry(baseRadius * 1.25, 32, 32);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(starColor),
      transparent: true,
      opacity: 0.35,
      side: THREE.BackSide
    });
    this.coronaMesh = new THREE.Mesh(coronaGeom, coronaMat);
    this.scene.add(this.coronaMesh);

    // 3. Binary Companion Star (if enabled)
    if (params.isBinary) {
      const compRadius = Math.max(3, Math.min(15, Math.log2(params.companionMass + 1) * 4));
      const compGeom = new THREE.SphereGeometry(compRadius, 32, 32);
      const compMat = new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        emissive: 0x00aaff,
        emissiveIntensity: 0.6
      });
      this.companionMesh = new THREE.Mesh(compGeom, compMat);
      this.companionMesh.position.set(baseRadius * 3 + 20, 0, 0);
      this.scene.add(this.companionMesh);
    }

    // 4. Create 3D Onion Fusion Core Cutaway Group (Hidden by default)
    this.createCoreCutaway(baseRadius);

    // 5. Create Ejecta Particle System & Shockwave
    this.createEjectaParticleSystem(baseRadius);
    this.createShockwaveRing(baseRadius);
    this.createRemnantObject(baseRadius);

    // 6. Update HUD Displays
    this.updateHUDTelemetry();
    this.renderHRDiagramAndShells();

    // 7. Update 3D visibility based on active timeline stage
    this.updateStageVisibility();
  }

  /**
   * Helper to determine hex color string from surface temperature (K)
   */
  getStarColorHex(temp) {
    if (temp >= 30000) return '#00d2ff'; // O-type Blue
    if (temp >= 15000) return '#4488ff'; // B-type Deep Blue
    if (temp >= 9000) return '#ffffff';  // A-type White
    if (temp >= 6500) return '#fff5cc';  // F-type Yellow-White
    if (temp >= 5200) return '#ffaa00';  // G-type Yellow
    if (temp >= 3700) return '#ff6600';  // K-type Orange
    return '#ff2200';                    // M-type Red Supergiant
  }

  /**
   * Create 3D Onion Fusion Shells Cutaway Group
   */
  createCoreCutaway(baseRadius) {
    this.coreCutawayGroup = new THREE.Group();
    const shells = this.starData.coreShells;

    shells.forEach((shell, idx) => {
      const radius = baseRadius * shell.radiusFrac;
      const geom = new THREE.SphereGeometry(radius, 32, 32);
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(shell.color),
        emissive: new THREE.Color(shell.color),
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.7,
        wireframe: idx % 2 === 1
      });
      const shellMesh = new THREE.Mesh(geom, mat);
      this.coreCutawayGroup.add(shellMesh);
    });

    this.coreCutawayGroup.visible = false;
    this.scene.add(this.coreCutawayGroup);
  }

  /**
   * Create High-Count 3D Particle Ejecta Cloud
   */
  createEjectaParticleSystem(baseRadius) {
    const particleCount = 12000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    this.ejectaVelocities = [];

    const pTex = TextureGenerator.generateParticleTexture();

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * baseRadius * 0.5;
      positions[i * 3 + 1] = (Math.random() - 0.5) * baseRadius * 0.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * baseRadius * 0.5;

      // Radial speed & directional vector
      const dir = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1
      ).normalize();

      const speed = (0.5 + Math.random() * 1.5) * (this.starData.ejectaVelocityKms / 5000);
      this.ejectaVelocities.push(dir.multiplyScalar(speed));

      // Color coding: Inner Iron (grey/red), Mid Oxygen (cyan/purple), Outer Hydrogen (gold/red)
      let pColor;
      if (i < particleCount * 0.2) pColor = new THREE.Color(0xff3300); // Inner Iron
      else if (i < particleCount * 0.6) pColor = new THREE.Color(0x00f0ff); // Mid Oxygen/Silicon
      else pColor = new THREE.Color(0xffaa00); // Outer Hydrogen

      colors[i * 3] = pColor.r;
      colors[i * 3 + 1] = pColor.g;
      colors[i * 3 + 2] = pColor.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 2.5,
      map: pTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.ejectaParticles = new THREE.Points(geometry, material);
    this.ejectaParticles.visible = false;
    this.scene.add(this.ejectaParticles);
  }

  /**
   * Create Expanding Shockwave Wavefront Ring
   */
  createShockwaveRing(baseRadius) {
    const geom = new THREE.RingGeometry(baseRadius, baseRadius * 1.2, 64);
    const shockTex = TextureGenerator.generateShockwaveTexture();
    const mat = new THREE.MeshBasicMaterial({
      map: shockTex,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    this.shockwaveMesh = new THREE.Mesh(geom, mat);
    this.shockwaveMesh.rotation.x = Math.PI / 2;
    this.shockwaveMesh.visible = false;
    this.scene.add(this.shockwaveMesh);
  }

  /**
   * Create Compact Central Remnant Object (Neutron Star / Black Hole / Planetary Nebula)
   */
  createRemnantObject(baseRadius) {
    const remnantType = this.starData.fate.remnantType;
    const remnantGroup = new THREE.Group();

    if (remnantType === 'neutronstar') {
      // Glowing Neutron Star Core
      const nsGeom = new THREE.SphereGeometry(2.0, 32, 32);
      const nsMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const nsCore = new THREE.Mesh(nsGeom, nsMat);
      remnantGroup.add(nsCore);

      // Relativistic Beaming Cone Jets
      const jetGeom = new THREE.CylinderGeometry(0.2, 8.0, 50, 32, 1, true);
      const jetTex = TextureGenerator.generatePulsarBeamTexture();
      const jetMat = new THREE.MeshBasicMaterial({
        map: jetTex,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
      });
      const topJet = new THREE.Mesh(jetGeom, jetMat);
      topJet.position.y = 25;
      const bottomJet = new THREE.Mesh(jetGeom, jetMat);
      bottomJet.position.y = -25;
      bottomJet.rotation.z = Math.PI;

      remnantGroup.add(topJet);
      remnantGroup.add(bottomJet);
      this.pulsarBeamMesh = remnantGroup;

    } else if (remnantType === 'blackhole') {
      // Event Horizon Black Sphere
      const bhGeom = new THREE.SphereGeometry(3.5, 32, 32);
      const bhMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
      const bhSphere = new THREE.Mesh(bhGeom, bhMat);
      remnantGroup.add(bhSphere);

      // Glowing Accretion Disk
      const diskGeom = new THREE.RingGeometry(4.0, 18.0, 64);
      const diskTex = TextureGenerator.generateBlackHoleDiskTexture();
      const diskMat = new THREE.MeshBasicMaterial({
        map: diskTex,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      });
      const accretionDisk = new THREE.Mesh(diskGeom, diskMat);
      accretionDisk.rotation.x = Math.PI / 2.5;
      remnantGroup.add(accretionDisk);

    } else if (remnantType === 'whitedwarf') {
      const wdGeom = new THREE.SphereGeometry(1.8, 32, 32);
      const wdMat = new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        emissive: 0x00f0ff,
        emissiveIntensity: 0.9
      });
      remnantGroup.add(new THREE.Mesh(wdGeom, wdMat));
    }

    this.remnantMesh = remnantGroup;
    this.remnantMesh.visible = false;
    this.scene.add(this.remnantMesh);
  }

  /**
   * Clear existing 3D objects from Three.js scene
   */
  clear3DScene() {
    [this.starMesh, this.coronaMesh, this.companionMesh, this.coreCutawayGroup, this.ejectaParticles, this.shockwaveMesh, this.remnantMesh].forEach(obj => {
      if (obj) {
        this.scene.remove(obj);
      }
    });
    this.starMesh = null;
    this.coronaMesh = null;
    this.companionMesh = null;
    this.coreCutawayGroup = null;
    this.ejectaParticles = null;
    this.shockwaveMesh = null;
    this.remnantMesh = null;
  }

  /**
   * Load Real Supernova Data from Database
   */
  loadRealSupernova(id) {
    const data = REAL_SUPERNOVAE_DB.find(s => s.id === id) || REAL_SUPERNOVAE_DB[0];
    this.currentMode = 'scientific';
    this.updateModeBadge();

    // Fill Explore Telemetry Card
    document.getElementById('real-name').innerText = data.name;
    document.getElementById('real-type-badge').innerText = data.type;
    document.getElementById('real-distance').innerText = data.distanceLightYears;
    document.getElementById('real-progenitor').innerText = data.progenitorName;
    document.getElementById('real-mass').innerText = data.progenitorMass;
    document.getElementById('real-remnant').innerText = data.remnantType;
    document.getElementById('real-speed').innerText = data.expansionSpeed;
    document.getElementById('real-desc').innerText = data.description;
    document.getElementById('real-telescope-notes').innerHTML = `
      <strong>Chandra X-Ray:</strong> ${data.telemetry.chandra}<br>
      <strong>JWST Infrared:</strong> ${data.telemetry.jwst}
    `;

    this.currentParams = { ...data.starParams };
    this.buildStarSystem(this.currentParams);
    this.setStage(0);
  }

  /**
   * Timeline Stage Visibility State Machine
   */
  setStage(stageIdx) {
    this.currentStage = parseInt(stageIdx);
    this.simTime = 0;

    // Update active button state in UI footer
    document.querySelectorAll('.stage-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.stage) === this.currentStage);
    });

    this.updateStageVisibility();

    // Trigger Audio Sound Effects
    if (this.currentStage === 2) this.audio.playCoreCollapse();
    if (this.currentStage === 3) this.audio.playExplosion();
    if (this.currentStage === 4 && this.starData?.fate?.remnantType === 'neutronstar') {
      this.audio.playPulsarBeep();
    }
  }

  /**
   * Update visibility of 3D objects based on current stage
   */
  updateStageVisibility() {
    const isCoreCutaway = document.getElementById('toggle-core-cutaway')?.checked;

    if (this.starMesh) this.starMesh.visible = (this.currentStage < 3) && !isCoreCutaway;
    if (this.coronaMesh) this.coronaMesh.visible = (this.currentStage < 3) && !isCoreCutaway;
    if (this.companionMesh) this.companionMesh.visible = (this.currentParams.isBinary && this.currentStage < 4);
    if (this.coreCutawayGroup) this.coreCutawayGroup.visible = (this.currentStage === 1 || isCoreCutaway) && (this.currentStage < 3);

    if (this.shockwaveMesh) this.shockwaveMesh.visible = (this.currentStage >= 3);
    if (this.ejectaParticles) this.ejectaParticles.visible = (this.currentStage >= 3);
    if (this.remnantMesh) this.remnantMesh.visible = (this.currentStage >= 4 && this.starData?.fate?.remnantType !== 'none');
  }

  /**
   * Update Quick Telemetry & Stats in HUD
   */
  updateHUDTelemetry() {
    if (!this.starData) return;
    document.getElementById('tele-spectral').innerText = this.starData.spectralClass;
    document.getElementById('tele-lum').innerText = `${this.starData.luminosity.toLocaleString()} L☉`;
    document.getElementById('tele-vel').innerText = `${this.starData.ejectaVelocityKms.toLocaleString()} km/s`;
    document.getElementById('tele-energy').innerText = `${this.starData.explosionEnergyBethes} Bethes`;

    // Nucleosynthesis yields
    document.getElementById('yield-iron').innerText = `${this.starData.nucleosynthesis.ironNi} M☉`;
    document.getElementById('yield-oxygen').innerText = `${this.starData.nucleosynthesis.oxygen} M☉`;
    document.getElementById('yield-silicon').innerText = `${this.starData.nucleosynthesis.silicon} M☉`;
    document.getElementById('yield-gold').innerText = `${this.starData.nucleosynthesis.rProcessGoldPt} M☉`;

    // Creative Corner preview fate
    document.getElementById('preview-fate-badge').innerText = this.starData.fate.badge;
    document.getElementById('preview-remnant-text').innerText = `Remnant: ${this.starData.fate.remnant}`;
  }

  /**
   * Render 3D Onion Fusion Shell Inspector List
   */
  renderHRDiagramAndShells() {
    const listContainer = document.getElementById('core-shells-list');
    if (!listContainer || !this.starData) return;

    listContainer.innerHTML = '';
    this.starData.coreShells.forEach(shell => {
      const item = document.createElement('div');
      item.className = 'shell-item';
      item.style.borderLeftColor = shell.color;
      item.innerHTML = `
        <div>
          <div class="shell-name">${shell.name} (${shell.element})</div>
          <div class="shell-temp">T = ${shell.temp}</div>
        </div>
        <span class="badge" style="background:${shell.color}; color:#000;">${shell.fusionTime || 'Stable'}</span>
      `;
      listContainer.appendChild(item);
    });
  }

  /**
   * UI Event Bindings
   */
  setupUIEvents() {
    // Navigation Tabs
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));

        btn.classList.add('active');
        const tabId = btn.dataset.tab;
        this.activeTab = tabId;
        document.getElementById(`tab-${tabId}`).classList.add('active');
        this.audio.playUIClick();

        if (tabId === 'create' || tabId === 'whatif' || tabId === 'random') {
          this.currentMode = 'creative';
        } else {
          this.currentMode = 'scientific';
        }
        this.updateModeBadge();
      });
    });

    // Real Supernova Selector
    document.getElementById('select-real-supernova')?.addEventListener('change', (e) => {
      this.loadRealSupernova(e.target.value);
    });

    // Witness Explosion Button
    document.getElementById('btn-trigger-explosion')?.addEventListener('click', () => {
      this.setStage(3);
    });

    // Creative Corner Sliders
    const sliders = ['mass', 'temp', 'rotation', 'metallicity', 'companion-mass'];
    sliders.forEach(key => {
      const slider = document.getElementById(`slider-${key}`);
      const valDisplay = document.getElementById(`val-${key}`);
      if (slider) {
        slider.addEventListener('input', () => {
          let suffix = ' M☉';
          if (key === 'temp') suffix = ' K';
          if (key === 'rotation') suffix = '%';
          if (key === 'metallicity') suffix = ' Z☉';
          if (valDisplay) valDisplay.innerText = `${slider.value}${suffix}`;
          this.onCreativeParamsChanged();
        });
      }
    });

    // Toggle Binary
    document.getElementById('toggle-binary')?.addEventListener('change', (e) => {
      document.getElementById('binary-controls').classList.toggle('hidden', !e.target.checked);
      this.onCreativeParamsChanged();
    });

    // Run Creative Simulation
    document.getElementById('btn-run-simulation')?.addEventListener('click', () => {
      this.buildStarSystem(this.currentParams);
      this.setStage(3);
    });

    // Random Star Generator
    document.getElementById('btn-generate-random')?.addEventListener('click', () => {
      this.generateRandomStar();
    });

    // Prediction Choice Buttons
    document.querySelectorAll('.pred-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.pred-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedPrediction = btn.dataset.choice;
        const revealBtn = document.getElementById('btn-reveal-prediction');
        revealBtn.disabled = false;
        revealBtn.classList.remove('disabled');
      });
    });

    // Reveal Prediction Result
    document.getElementById('btn-reveal-prediction')?.addEventListener('click', () => {
      this.evaluatePrediction();
    });

    document.getElementById('btn-close-pred-modal')?.addEventListener('click', () => {
      document.getElementById('modal-prediction').classList.remove('active');
    });

    document.getElementById('btn-continue-pred')?.addEventListener('click', () => {
      document.getElementById('modal-prediction').classList.remove('active');
    });

    // What-If Experiment Slots
    document.getElementById('btn-save-slot-a')?.addEventListener('click', () => {
      this.slotAData = { ...this.starData };
      document.getElementById('slot-a-summary').innerHTML = `
        <strong>${this.slotAData.mass} M☉ Star</strong><br>
        Temp: ${this.slotAData.temperature}K | ${this.slotAData.fate.badge}
      `;
      this.showToast('📌 Saved current star to Slot A (Baseline)');
    });

    document.getElementById('btn-save-slot-b')?.addEventListener('click', () => {
      this.slotBData = { ...this.starData };
      document.getElementById('slot-b-summary').innerHTML = `
        <strong>${this.slotBData.mass} M☉ Star</strong><br>
        Temp: ${this.slotBData.temperature}K | ${this.slotBData.fate.badge}
      `;
      this.showToast('📌 Saved current star to Slot B (Modified)');
    });

    // Open What-If Comparison
    document.getElementById('btn-compare-whatif')?.addEventListener('click', () => {
      this.renderWhatIfComparison();
    });

    document.getElementById('btn-close-whatif-modal')?.addEventListener('click', () => {
      document.getElementById('modal-whatif').classList.remove('active');
    });

    document.getElementById('btn-close-whatif')?.addEventListener('click', () => {
      document.getElementById('modal-whatif').classList.remove('active');
    });

    // Timeline Scrubbing Stepper Buttons
    document.querySelectorAll('.stage-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setStage(btn.dataset.stage);
      });
    });

    // Audio & View Controls
    document.getElementById('btn-toggle-audio')?.addEventListener('click', () => {
      const enable = !this.audio.isEnabled;
      this.audio.toggleAudio(enable);
      document.getElementById('btn-toggle-audio').innerText = enable ? '🔊 Sound: On' : '🔇 Sound: Off';
    });

    document.getElementById('btn-reset-view')?.addEventListener('click', () => {
      this.camera.position.set(0, 40, 180);
      this.controls.target.set(0, 0, 0);
    });

    // Toggles
    document.getElementById('toggle-core-cutaway')?.addEventListener('change', () => {
      this.updateStageVisibility();
    });
  }

  /**
   * Real-time update when sliders move in Creative Corner
   */
  onCreativeParamsChanged() {
    this.currentParams = {
      mass: parseFloat(document.getElementById('slider-mass').value),
      temperature: parseFloat(document.getElementById('slider-temp').value),
      rotation: parseFloat(document.getElementById('slider-rotation').value),
      metallicity: parseFloat(document.getElementById('slider-metallicity').value),
      isBinary: document.getElementById('toggle-binary').checked,
      companionMass: parseFloat(document.getElementById('slider-companion-mass').value)
    };

    this.starData = AstrophysicsEngine.analyzeStar(this.currentParams);
    this.updateHUDTelemetry();
  }

  /**
   * Generate Random Star Parameters for Prediction Game
   */
  generateRandomStar() {
    const randMass = Math.round((8 + Math.random() * 140) * 10) / 10;
    const randRot = Math.round(Math.random() * 90);
    const randMetal = Math.round((0.05 + Math.random() * 2.5) * 100) / 100;
    const randBinary = Math.random() > 0.5;
    const randCompMass = randBinary ? Math.round((1 + Math.random() * 20) * 10) / 10 : 0;

    this.randomStarParams = {
      mass: randMass,
      rotation: randRot,
      metallicity: randMetal,
      isBinary: randBinary,
      companionMass: randCompMass
    };

    document.getElementById('rand-star-id').innerText = `STAR #${Math.floor(1000 + Math.random() * 9000)}`;
    document.getElementById('rand-mass').innerText = `${randMass} M☉`;
    document.getElementById('rand-rotation').innerText = `${randRot}%`;
    document.getElementById('rand-metallicity').innerText = `${randMetal} Z☉`;
    document.getElementById('rand-binary').innerText = randBinary ? `YES (${randCompMass} M☉)` : 'NO';

    // Clear prediction choice selection
    document.querySelectorAll('.pred-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('btn-reveal-prediction').disabled = true;
    document.getElementById('btn-reveal-prediction').classList.add('disabled');

    this.buildStarSystem(this.randomStarParams);
    this.showToast('🎲 New Hypothetical Star System Generated!');
  }

  /**
   * Evaluate Prediction Outcome & Show Modal Rationale
   */
  evaluatePrediction() {
    if (!this.selectedPrediction || !this.starData) return;

    const actualRemnantType = this.starData.fate.remnantType;
    let isCorrect = false;

    if (this.selectedPrediction === 'neutronstar' && actualRemnantType === 'neutronstar') isCorrect = true;
    if (this.selectedPrediction === 'blackhole' && actualRemnantType === 'blackhole') isCorrect = true;
    if (this.selectedPrediction === 'pairinstability' && actualRemnantType === 'none') isCorrect = true;
    if (this.selectedPrediction === 'typeia' && this.starData.fate.type.includes('Type Ia')) isCorrect = true;
    if (this.selectedPrediction === 'failedsn' && actualRemnantType === 'blackhole' && this.starData.fate.type.includes('Failed')) isCorrect = true;

    document.getElementById('pred-result-icon').innerText = isCorrect ? '🎉' : '🤔';
    document.getElementById('pred-result-status').innerText = isCorrect ? 'ACCURATE PREDICTION!' : 'ASTROPHYSICAL DISCOVERY!';
    document.getElementById('pred-result-status').style.color = isCorrect ? 'var(--accent-cyan)' : 'var(--accent-amber)';
    document.getElementById('pred-result-text').innerText = `Model Outcome: ${this.starData.fate.badge} (${this.starData.fate.remnant})`;
    document.getElementById('pred-astrophysics-exp').innerText = this.starData.fate.description;

    document.getElementById('modal-prediction').classList.add('active');
    this.setStage(3);
  }

  /**
   * Render Side-by-Side "What If?" Comparison Grid Table
   */
  renderWhatIfComparison() {
    if (!this.slotAData || !this.slotBData) {
      this.showToast('⚠️ Please save stars into BOTH Slot A and Slot B first!');
      return;
    }

    const tbody = document.getElementById('whatif-table-body');
    tbody.innerHTML = `
      <tr>
        <td><strong>Stellar Mass</strong></td>
        <td>${this.slotAData.mass} M☉</td>
        <td>${this.slotBData.mass} M☉</td>
        <td>${(this.slotBData.mass - this.slotAData.mass).toFixed(1)} M☉ diff</td>
      </tr>
      <tr>
        <td><strong>Surface Temp / Spec Class</strong></td>
        <td>${this.slotAData.spectralClass}</td>
        <td>${this.slotBData.spectralClass}</td>
        <td>Temperature change</td>
      </tr>
      <tr>
        <td><strong>Supernova Outcome</strong></td>
        <td>${this.slotAData.fate.badge}</td>
        <td>${this.slotBData.fate.badge}</td>
        <td><strong>${this.slotAData.fate.remnantType === this.slotBData.fate.remnantType ? 'Same Remnant' : 'DIFFERENT FATE!'}</strong></td>
      </tr>
      <tr>
        <td><strong>Remnant Object</strong></td>
        <td>${this.slotAData.fate.remnant}</td>
        <td>${this.slotBData.fate.remnant}</td>
        <td>Remnant Structure</td>
      </tr>
      <tr>
        <td><strong>Explosion Energy</strong></td>
        <td>${this.slotAData.explosionEnergyBethes} Bethes</td>
        <td>${this.slotBData.explosionEnergyBethes} Bethes</td>
        <td>${(this.slotBData.explosionEnergyBethes - this.slotAData.explosionEnergyBethes).toFixed(1)} Bethes diff</td>
      </tr>
      <tr>
        <td><strong>Ejecta Expansion Velocity</strong></td>
        <td>${this.slotAData.ejectaVelocityKms} km/s</td>
        <td>${this.slotBData.ejectaVelocityKms} km/s</td>
        <td>${this.slotBData.ejectaVelocityKms - this.slotAData.ejectaVelocityKms} km/s diff</td>
      </tr>
      <tr>
        <td><strong>Iron/Nickel Synthesized</strong></td>
        <td>${this.slotAData.nucleosynthesis.ironNi} M☉</td>
        <td>${this.slotBData.nucleosynthesis.ironNi} M☉</td>
        <td>Iron yield diff</td>
      </tr>
    `;

    document.getElementById('modal-whatif').classList.add('active');
  }

  /**
   * Update Scientific Mode vs Creative Mode Header Badge
   */
  updateModeBadge() {
    const badge = document.getElementById('mode-badge');
    const text = document.getElementById('mode-badge-text');

    if (this.currentMode === 'scientific') {
      badge.className = 'mode-badge scientific-mode';
      text.innerText = '🔬 SCIENTIFIC MODE';
    } else {
      badge.className = 'mode-badge creative-mode';
      text.innerText = '🎨 CREATIVE MODE (HYPOTHETICAL)';
    }
  }

  /**
   * Display Toast Message Notification
   */
  showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerText = msg;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
  }

  /**
   * Handle Window Resize
   */
  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /**
   * Main WebGL Animation Loop
   */
  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = 0.016 * this.timeSpeed;
    this.simTime += delta;

    // 1. Star surface & companion rotation
    if (this.starMesh) this.starMesh.rotation.y += 0.005;
    if (this.coronaMesh) this.coronaMesh.rotation.y -= 0.003;

    if (this.companionMesh && this.starMesh) {
      const angle = this.simTime * 0.5;
      const dist = 40;
      this.companionMesh.position.x = Math.cos(angle) * dist;
      this.companionMesh.position.z = Math.sin(angle) * dist;
    }

    // 2. Pulsar beam rotation
    if (this.pulsarBeamMesh) {
      this.pulsarBeamMesh.rotation.y += 0.15;
    }

    // 3. Ejecta Expansion Animation in Explosion Stage
    if (this.currentStage >= 3 && this.ejectaParticles && this.ejectaVelocities.length > 0) {
      const positions = this.ejectaParticles.geometry.attributes.position.array;
      for (let i = 0; i < this.ejectaVelocities.length; i++) {
        const vel = this.ejectaVelocities[i];
        positions[i * 3] += vel.x * delta * 2;
        positions[i * 3 + 1] += vel.y * delta * 2;
        positions[i * 3 + 2] += vel.z * delta * 2;
      }
      this.ejectaParticles.geometry.attributes.position.needsUpdate = true;

      // Expand shockwave ring
      if (this.shockwaveMesh) {
        this.shockwaveMesh.scale.addScalar(0.015 * delta * 5);
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

// Instantiate on window load
window.addEventListener('DOMContentLoaded', () => {
  window.app = new SupernovaLabApp();
});
