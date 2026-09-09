/**
 * Space Simulation - Web Audio API Sound Synthesizer
 * Generates ambient deep space soundscapes and UI audio feedback.
 */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ambientGain = null;
    this.isMuted = true;
    this.isPlaying = false;
    this.osc1 = null;
    this.osc2 = null;
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master Ambient Gain
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0.05, this.ctx.currentTime);
      this.ambientGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn('Web Audio API not supported in this environment.', e);
    }
  }

  toggleAmbient(enable) {
    if (!this.ctx) this.init();
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.isMuted = !enable;

    if (enable && !this.isPlaying) {
      this.startSpaceDrone();
    } else if (!enable && this.isPlaying) {
      this.stopSpaceDrone();
    }
  }

  startSpaceDrone() {
    if (!this.ctx) return;

    // Deep sub drone
    this.osc1 = this.ctx.createOscillator();
    this.osc1.type = 'sine';
    this.osc1.frequency.setValueAtTime(55, this.ctx.currentTime); // A1 note

    // LFO Modulation for subtle space pulsing
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.2, this.ctx.currentTime); // 0.2 Hz slow pulse

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(10, this.ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(this.osc1.frequency);

    // Filter
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(150, this.ctx.currentTime);

    this.osc1.connect(filter);
    filter.connect(this.ambientGain);

    this.osc1.start();
    lfo.start();
    this.isPlaying = true;
  }

  stopSpaceDrone() {
    if (this.osc1) {
      try {
        this.osc1.stop();
        this.osc1.disconnect();
      } catch (e) {}
      this.osc1 = null;
    }
    this.isPlaying = false;
  }

  playClick() {
    if (this.isMuted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch (e) {}
  }

  playWarp() {
    if (this.isMuted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.4);

      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.4);
    } catch (e) {}
  }
}
