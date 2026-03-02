/**
 * audio/AudioManager.js
 *
 * Manages all game audio using the Web Audio API (no external files needed).
 * Sounds are synthesized procedurally so the game works offline.
 *
 * Usage:
 *   const audio = new AudioManager();
 *   audio.play('move');   // soft click on piece swap
 *   audio.play('fuse');   // satisfying chime when pieces fuse
 *   audio.play('win');    // fanfare on puzzle complete
 *
 * To add a sound: add an entry to this._sounds map.
 * To use audio files instead: replace _synth() with fetch + decodeAudioData.
 */

export class AudioManager {
  constructor() {
    this._ctx    = null;
    this._muted  = false;
    this._sounds = {
      move: (ctx) => this._synthMove(ctx),
      fuse: (ctx) => this._synthFuse(ctx),
      win:  (ctx) => this._synthWin(ctx),
    };
  }

  // ── Public ──────────────────────────────────────────────────────────────────

  /**
   * Play a named sound.
   * @param {'move'|'fuse'|'win'} name
   */
  play(name) {
    if (this._muted) return;
    const fn = this._sounds[name];
    if (!fn) return;
    try {
      const ctx = this._getContext();
      fn(ctx);
    } catch (e) {
      // Audio context may be blocked until user interaction — fail silently
    }
  }

  mute()   { this._muted = true; }
  unmute() { this._muted = false; }
  toggle() { this._muted = !this._muted; }

  /**
   * Warmup del AudioContext con user gesture (llamar en primer click/touch).
   * Necesario en iOS/Chrome por políticas de autoplay.
   */
  warmup() {
    try {
      const ctx = this._getContext();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch (_) {}
  }

  // ── Private: context ────────────────────────────────────────────────────────

  _getContext() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this._ctx.state === 'suspended') {
      this._ctx.resume().catch(() => {});
    }
    return this._ctx;
  }

  // ── Private: synth helpers ──────────────────────────────────────────────────

  /** Short soft click for piece swap */
  _synthMove(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type      = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  }

  /** Warm chime for fusion */
  _synthFuse(ctx) {
    const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
    freqs.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.05);

      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.05);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.05 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.05 + 0.5);

      osc.start(ctx.currentTime + i * 0.05);
      osc.stop(ctx.currentTime + i * 0.05 + 0.5);
    });
  }

  /** Ascending fanfare for win */
  _synthWin(ctx) {
    const notes = [
      { freq: 523.25, t: 0.0  },
      { freq: 659.25, t: 0.12 },
      { freq: 783.99, t: 0.24 },
      { freq: 1046.5, t: 0.36 },
    ];
    notes.forEach(({ freq, t }) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + t);

      gain.gain.setValueAtTime(0, ctx.currentTime + t);
      gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.6);

      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.65);
    });
  }
}
