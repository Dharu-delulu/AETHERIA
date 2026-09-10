/**
 * SUPERNOVA LAB - Web Audio API Synthesizer
 * Dynamic procedural sound engine for ambient cosmic drone, core collapse rumble,
 * supernova shockwave detonation sound, pulsar radio pulses, and UI audio feedback.
 */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ambientOsc1 = null;
    this.ambientOsc2 = null;
    this.ambientGain = null;
    this.isEnabled = false;
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleAudio(enable) {
    this.isEnabled = enable;
    if (enable) {
      this.initContext();
      this.startAmbientDrone();
    } else {
      this.stopAmbientDrone();
    }
  }

  startAmbientDrone() {
    if (!this.ctx || !this.isEnabled || this.ambientGain) return;

    try {
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      this.ambientGain.connect(this.ctx.destination);

      // Low cosmic drone 55Hz (A1)
      this.ambientOsc1 = this.ctx.createOscillator();
      this.ambientOsc1.type = 'sine';
      this.ambientOsc1.frequency.setValueAtTime(55, this.ctx.currentTime);

      // Warm harmonic 110Hz (A2)
      this.ambientOsc2 = this.ctx.createOscillator();
      this.ambientOsc2.type = 'triangle';
      this.ambientOsc2.frequency.setValueAtTime(110, this.ctx.currentTime);

      // LFO filter for subtle deep-space pulsing
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(200, this.ctx.currentTime);

      this.ambientOsc1.connect(filter);
      this.ambientOsc2.connect(filter);
      filter.connect(this.ambientGain);

      this.ambientOsc1.start();
      this.ambientOsc2.start();
    } catch (e) {
      console.warn('Audio start ambient failed:', e);
    }
  }

  stopAmbientDrone() {
    if (this.ambientGain) {
      try {
        this.ambientGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.5);
        setTimeout(() => {
          if (this.ambientOsc1) this.ambientOsc1.stop();
          if (this.ambientOsc2) this.ambientOsc2.stop();
          this.ambientOsc1 = null;
          this.ambientOsc2 = null;
          this.ambientGain = null;
        }, 500);
      } catch (e) {}
    }
  }

  /**
   * Sound effect for Core Collapse (Descending Sub-bass Frequency Drop)
   */
  playCoreCollapse() {
    if (!this.isEnabled) return;
    this.initContext();

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 1.2);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, now);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 1.3);
    } catch (e) {}
  }

  /**
   * Sound effect for Supernova Explosion Detonation (Impact Blast)
   */
  playExplosion() {
    if (!this.isEnabled) return;
    this.initContext();

    try {
      const now = this.ctx.currentTime;

      // 1. Noise buffer for shockwave blast
      const bufferSize = this.ctx.sampleRate * 2.0;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.exponentialRampToValueAtTime(40, now + 1.8);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.6, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.9);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      // 2. Sub-bass punch (40Hz pulse)
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(80, now);
      subOsc.frequency.exponentialRampToValueAtTime(20, now + 1.5);

      subGain.gain.setValueAtTime(0.7, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

      subOsc.connect(subGain);
      subGain.connect(this.ctx.destination);

      noise.start(now);
      subOsc.start(now);
      subOsc.stop(now + 1.5);
    } catch (e) {}
  }

  /**
   * Pulsar Radio Beep Sound Effect
   */
  playPulsarBeep() {
    if (!this.isEnabled) return;
    this.initContext();

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {}
  }

  /**
   * UI Click Sound Effect
   */
  playUIClick() {
    if (!this.isEnabled) return;
    this.initContext();

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.04);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {}
  }

  // Legacy aliases
  playWarp() {
    this.playExplosion();
  }
}

window.AudioEngine = AudioEngine;
