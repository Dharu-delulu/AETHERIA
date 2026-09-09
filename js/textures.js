/**
 * Space Simulation - Procedural Canvas Texture Generator
 * Dynamically generates 2D canvas textures for planets, stars, rings, and space backgrounds
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

  // 1. Sun Surface Texture
  generateSunTexture() {
    const { canvas, ctx } = this.createCanvas(1024, 512);
    const width = canvas.width;
    const height = canvas.height;

    // Deep yellow-orange plasma base
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(0, 0, width, height);

    // Granulation and solar flare spots
    for (let i = 0; i < 3000; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const radius = Math.random() * 8 + 2;

      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.4, Math.random() > 0.5 ? '#ffcc00' : '#ff4400');
      grad.addColorStop(1, 'transparent');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    return this.toThreeTexture(canvas);
  },

  // 2. Mercury Texture (Cratered Grey/Brown)
  generateMercuryTexture() {
    const { canvas, ctx } = this.createCanvas(512, 256);
    ctx.fillStyle = '#8c8275';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Craters
    for (let i = 0; i < 400; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const radius = Math.random() * 6 + 1;

      ctx.fillStyle = 'rgba(40, 35, 30, 0.4)';
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Bright crater rim
      ctx.strokeStyle = 'rgba(200, 190, 180, 0.5)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    return this.toThreeTexture(canvas);
  },

  // 3. Venus Texture (Yellowish Dense Atmospheric Clouds)
  generateVenusTexture() {
    const { canvas, ctx } = this.createCanvas(512, 256);
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#e3bb76');
    grad.addColorStop(0.3, '#c99648');
    grad.addColorStop(0.6, '#e0c896');
    grad.addColorStop(1, '#b88337');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Swirling clouds
    ctx.fillStyle = 'rgba(255, 245, 220, 0.15)';
    for (let i = 0; i < 80; i++) {
      ctx.beginPath();
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      ctx.ellipse(x, y, Math.random() * 100 + 40, Math.random() * 20 + 5, Math.random(), 0, Math.PI * 2);
      ctx.fill();
    }

    return this.toThreeTexture(canvas);
  },

  // 4. Earth Texture (Ocean Blue, Green/Brown Continents, Ice Caps)
  generateEarthTexture() {
    const { canvas, ctx } = this.createCanvas(1024, 512);
    // Ocean
    ctx.fillStyle = '#1c4e80';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Continents (Procedural blobs)
    ctx.fillStyle = '#2e7d32';
    for (let i = 0; i < 150; i++) {
      const cx = Math.random() * canvas.width;
      const cy = (Math.random() * 0.7 + 0.15) * canvas.height;
      const rx = Math.random() * 120 + 30;
      const ry = Math.random() * 70 + 20;

      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    // Deserts/Mountains accents
    ctx.fillStyle = '#c2a649';
    for (let i = 0; i < 60; i++) {
      const cx = Math.random() * canvas.width;
      const cy = (Math.random() * 0.5 + 0.25) * canvas.height;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.random() * 30 + 10, 0, Math.PI * 2);
      ctx.fill();
    }

    // Polar Ice Caps
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, 35);
    ctx.fillRect(0, canvas.height - 35, canvas.width, 35);

    return this.toThreeTexture(canvas);
  },

  // 5. Earth Clouds Texture
  generateCloudsTexture() {
    const { canvas, ctx } = this.createCanvas(1024, 512);
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    for (let i = 0; i < 120; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const rx = Math.random() * 140 + 30;
      const ry = Math.random() * 30 + 10;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, Math.random() * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    return this.toThreeTexture(canvas);
  },

  // 6. Mars Texture (Dusty Red/Rusty Brown & Ice Caps)
  generateMarsTexture() {
    const { canvas, ctx } = this.createCanvas(512, 256);
    ctx.fillStyle = '#b7410e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Darker basaltic regions
    ctx.fillStyle = '#7a2906';
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      ctx.beginPath();
      ctx.ellipse(x, y, Math.random() * 60 + 20, Math.random() * 30 + 10, Math.random(), 0, Math.PI * 2);
      ctx.fill();
    }

    // Polar caps
    ctx.fillStyle = 'rgba(240, 245, 255, 0.9)';
    ctx.fillRect(0, 0, canvas.width, 18);
    ctx.fillRect(0, canvas.height - 18, canvas.width, 18);

    return this.toThreeTexture(canvas);
  },

  // 7. Jupiter Texture (Atmospheric Stripes & Great Red Spot)
  generateJupiterTexture() {
    const { canvas, ctx } = this.createCanvas(1024, 512);
    const bands = [
      '#c88b3a', '#e0ae6b', '#9c5b24', '#d29f63', '#a8622c',
      '#e6c594', '#8a4918', '#cc9752', '#b36d33', '#e0ae6b'
    ];

    const bandHeight = canvas.height / bands.length;
    bands.forEach((color, idx) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, idx * bandHeight, canvas.width, bandHeight);
    });

    // Swirl turbulence
    ctx.fillStyle = 'rgba(255, 230, 200, 0.2)';
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      ctx.beginPath();
      ctx.ellipse(x, y, Math.random() * 80 + 30, Math.random() * 12 + 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Great Red Spot
    const spotX = canvas.width * 0.65;
    const spotY = canvas.height * 0.68;
    const spotGrad = ctx.createRadialGradient(spotX, spotY, 5, spotX, spotY, 45);
    spotGrad.addColorStop(0, '#cc3300');
    spotGrad.addColorStop(0.7, '#992200');
    spotGrad.addColorStop(1, 'transparent');

    ctx.fillStyle = spotGrad;
    ctx.beginPath();
    ctx.ellipse(spotX, spotY, 50, 30, -0.2, 0, Math.PI * 2);
    ctx.fill();

    return this.toThreeTexture(canvas);
  },

  // 8. Saturn Texture (Pale Gold Bands)
  generateSaturnTexture() {
    const { canvas, ctx } = this.createCanvas(512, 256);
    const bands = ['#e2c48b', '#cbb075', '#eed9a8', '#b89c62', '#dfc796'];
    const bandHeight = canvas.height / bands.length;

    bands.forEach((color, idx) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, idx * bandHeight, canvas.width, bandHeight);
    });

    return this.toThreeTexture(canvas);
  },

  // 9. Saturn Ring Texture (Translucent Rings)
  generateRingTexture() {
    const { canvas, ctx } = this.createCanvas(512, 1);
    const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);

    grad.addColorStop(0.0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.2, 'rgba(210, 180, 130, 0.8)');
    grad.addColorStop(0.5, 'rgba(180, 150, 100, 0.4)');
    grad.addColorStop(0.65, 'rgba(0,0,0,0.1)'); // Cassini Division gap
    grad.addColorStop(0.75, 'rgba(220, 190, 140, 0.9)');
    grad.addColorStop(0.95, 'rgba(190, 160, 110, 0.6)');
    grad.addColorStop(1.0, 'rgba(0,0,0,0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, 1);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  },

  // 10. Uranus Texture (Cyan Ice)
  generateUranusTexture() {
    const { canvas, ctx } = this.createCanvas(256, 128);
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#7de3e0');
    grad.addColorStop(0.5, '#4bbbc0');
    grad.addColorStop(1, '#66d6d8');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return this.toThreeTexture(canvas);
  },

  // 11. Neptune Texture (Deep Azure Blue & Dark Storms)
  generateNeptuneTexture() {
    const { canvas, ctx } = this.createCanvas(256, 128);
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#2b52ba');
    grad.addColorStop(0.5, '#1b3b8c');
    grad.addColorStop(1, '#3563dc');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // White cirrus clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(40, 50, 60, 4);
    ctx.fillRect(150, 80, 40, 3);

    return this.toThreeTexture(canvas);
  }
};
