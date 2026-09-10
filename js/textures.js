/**
 * SUPERNOVA LAB - Procedural Canvas Texture Generator
 * Dynamically generates 2D canvas textures for stars, fusion shells,
 * particle ejecta, shockwaves, pulsars, and black hole accretion disks.
 */

const TextureGenerator = {
  // Helper to create canvas
  createCanvas(width = 1024, height = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    return { canvas, ctx };
  },

  // Convert canvas to Three.js CanvasTexture
  toThreeTexture(canvas) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  },

  // 1. Dynamic Star Surface Texture
  generateStarTexture(baseColorHex = '#ffaa00', tempK = 15000) {
    const { canvas, ctx } = this.createCanvas(1024, 512);
    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = baseColorHex;
    ctx.fillRect(0, 0, width, height);

    // Plasma convection granules
    for (let i = 0; i < 3500; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const radius = Math.random() * 10 + 2;

      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, baseColorHex);
      grad.addColorStop(1, 'transparent');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Solar flares & coronal spots
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      ctx.beginPath();
      ctx.ellipse(x, y, Math.random() * 60 + 20, Math.random() * 12 + 4, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    return this.toThreeTexture(canvas);
  },

  // 2. Supernova Particle Sprite Texture (Radial Glow Particle)
  generateParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(255, 200, 100, 0.8)');
    grad.addColorStop(0.7, 'rgba(255, 50, 0, 0.3)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    return new THREE.CanvasTexture(canvas);
  },

  // 3. Shockwave Ring Texture
  generateShockwaveTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(128, 128, 60, 128, 128, 128);
    grad.addColorStop(0, 'rgba(0, 240, 255, 0)');
    grad.addColorStop(0.5, 'rgba(0, 240, 255, 0.9)');
    grad.addColorStop(0.8, 'rgba(255, 0, 128, 0.6)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    return new THREE.CanvasTexture(canvas);
  },

  // 4. Pulsar Relativistic Beaming Jet Texture
  generatePulsarBeamTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.2, 'rgba(0, 240, 255, 0.8)');
    grad.addColorStop(0.6, 'rgba(128, 0, 255, 0.4)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 512);

    return new THREE.CanvasTexture(canvas);
  },

  // 5. Black Hole Accretion Disk Texture
  generateBlackHoleDiskTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(256, 256, 50, 256, 256, 256);
    grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
    grad.addColorStop(0.25, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.4, 'rgba(255, 170, 0, 0.9)');
    grad.addColorStop(0.7, 'rgba(255, 0, 64, 0.5)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    return new THREE.CanvasTexture(canvas);
  },

  // Legacy Solar System textures
  generateSunTexture() {
    return this.generateStarTexture('#ffaa00', 5778);
  },

  generateMercuryTexture() {
    const { canvas, ctx } = this.createCanvas(512, 256);
    ctx.fillStyle = '#8c8275';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return this.toThreeTexture(canvas);
  },

  generateVenusTexture() {
    const { canvas, ctx } = this.createCanvas(512, 256);
    ctx.fillStyle = '#e3bb76';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return this.toThreeTexture(canvas);
  },

  generateEarthTexture() {
    const { canvas, ctx } = this.createCanvas(1024, 512);
    ctx.fillStyle = '#1b4d8e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return this.toThreeTexture(canvas);
  }
};

window.TextureGenerator = TextureGenerator;
