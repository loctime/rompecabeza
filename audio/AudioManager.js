/**
 * audio/AudioManager.js
 *
 * Manages all game audio using the Web Audio API (no external files needed).
 * Sounds are synthesized procedurally so the game works offline.
 */

export class AudioManager {
  constructor() {
    this._ctx = null;
    this._sfxOut = null;
    this._sfxVolume = 0.9;
    this._muted = false;
    this._sounds = {
      move: (ctx) => this._synthMove(ctx),
      fuse: (ctx) => this._synthFuse(ctx),
      win: (ctx) => this._synthWin(ctx),
      invalid: (ctx) => this._synthInvalid(ctx),
    };
  }

  /**
   * Play a named sound.
   * @param {'move'|'fuse'|'win'|'invalid'} name
   */
  play(name) {
    if (this._muted) return;
    const fn = this._sounds[name];
    if (!fn) return;
    try {
      const ctx = this._getContext();
      fn(ctx);
    } catch (_) {
      // Audio context may be blocked until user interaction.
    }
  }

  /** Soft victory chime. */
  playVictoryChime() {
    if (this._muted) return;
    try {
      const ctx = this._getContext();
      this._synthVictoryChime(ctx);
    } catch (_) {}
  }

  /** Soft snap tick; intensity in [0,1] changes gain/duration. */
  playSnapTick(intensity = 0.7) {
    if (this._muted) return;
    try {
      const ctx = this._getContext();
      this._synthSnapTick(ctx, Math.max(0.1, Math.min(1, intensity)));
    } catch (_) {}
  }

  mute() { this._muted = true; }
  unmute() { this._muted = false; }
  toggle() { this._muted = !this._muted; }

  setVolume(value) {
    this._sfxVolume = Math.max(0, Math.min(1, Number(value) || 0));
    if (this._sfxOut) this._sfxOut.gain.value = this._sfxVolume;
  }

  /** Warmup AudioContext with user gesture. */
  warmup() {
    try {
      const ctx = this._getContext();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch (_) {}
  }

  _getContext() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this._ctx.state === 'suspended') {
      this._ctx.resume().catch(() => {});
    }
    return this._ctx;
  }

  _getSfxOutput(ctx) {
    if (!this._sfxOut) {
      this._sfxOut = ctx.createGain();
      this._sfxOut.gain.value = this._sfxVolume;
      this._sfxOut.connect(ctx.destination);
    }
    return this._sfxOut;
  }

  _synthInvalid(ctx) {
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(this._getSfxOutput(ctx));
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t0);
    osc.frequency.exponentialRampToValueAtTime(120, t0 + 0.06);
    gain.gain.setValueAtTime(0.08, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.1);
    osc.start(t0);
    osc.stop(t0 + 0.1);
  }

  _synthMove(ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(this._getSfxOutput(ctx));

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  }

  _synthFuse(ctx) {
    const freqs = [523.25, 659.25, 783.99];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(this._getSfxOutput(ctx));

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.05);

      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.05);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.05 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.05 + 0.5);

      osc.start(ctx.currentTime + i * 0.05);
      osc.stop(ctx.currentTime + i * 0.05 + 0.5);
    });
  }

  _synthVictoryChime(ctx) {
    const t0 = ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(this._getSfxOutput(ctx));
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0 + i * 0.06);
      gain.gain.setValueAtTime(0, t0 + i * 0.06);
      gain.gain.linearRampToValueAtTime(0.06, t0 + i * 0.06 + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.06 + 0.5);
      osc.start(t0 + i * 0.06);
      osc.stop(t0 + i * 0.06 + 0.5);
    });

    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.connect(subGain);
    subGain.connect(this._getSfxOutput(ctx));
    sub.type = 'sine';
    sub.frequency.setValueAtTime(130.81, t0);
    subGain.gain.setValueAtTime(0, t0);
    subGain.gain.linearRampToValueAtTime(0.03, t0 + 0.08);
    subGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.45);
    sub.start(t0);
    sub.stop(t0 + 0.45);
  }

  _synthSnapTick(ctx, intensity) {
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(this._getSfxOutput(ctx));
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, t0);
    osc.frequency.exponentialRampToValueAtTime(260, t0 + 0.05);
    gain.gain.setValueAtTime(0.03 * intensity, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08);
    osc.start(t0);
    osc.stop(t0 + 0.08);
  }

  _synthWin(ctx) {
    const t0 = ctx.currentTime;
    const notes = [
      { freq: 523.25, t: 0.0 },
      { freq: 659.25, t: 0.14 },
      { freq: 783.99, t: 0.28 },
      { freq: 1046.5, t: 0.42 },
    ];
    notes.forEach(({ freq, t }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(this._getSfxOutput(ctx));
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0 + t);
      gain.gain.setValueAtTime(0, t0 + t);
      gain.gain.linearRampToValueAtTime(0.08, t0 + t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + t + 0.55);
      osc.start(t0 + t);
      osc.stop(t0 + t + 0.55);
    });
  }
}
