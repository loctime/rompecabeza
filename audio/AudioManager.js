const NOTES = [
  261.63, // C
  329.63, // E
  392.0,  // G
  523.25, // C octave
];

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function jitter(value, amount = 0.012) {
  return value * (1 + (Math.random() * 2 - 1) * amount);
}

export class AudioManager {
  constructor() {
    this._ctx = null;
    this._sfxOut = null;
    this._sfxVolume = 0.9;
    this._muted = false;

    this._lastFuseAt = 0;
    this._fuseCombo = 0;

    this._sounds = {
      move: () => this.playMoveClick(),
      invalid: () => this.playInvalidSoft(),
      fuse: () => {
        const now = performance.now();
        this._fuseCombo = (now - this._lastFuseAt <= 950) ? this._fuseCombo + 1 : 0;
        this._lastFuseAt = now;
        this.playFuse(this._fuseCombo);
      },
      win: () => this.playVictoryChord(),
      shuffle: () => this.playShuffle(),
    };
  }

  play(name) {
    if (this._muted) return;
    const fn = this._sounds[name];
    if (!fn) return;
    try {
      this._ensureRunning();
      fn();
    } catch (_) {}
  }

  // Backward compatibility with current triggers in main.js.
  playVictoryChime() {
    this.playVictoryChord();
  }

  // Backward compatibility with current triggers in main.js.
  playSnapTick(intensity = 0.7) {
    const scaled = Math.max(0.1, Math.min(1, intensity));
    const now = performance.now();
    this._fuseCombo = (now - this._lastFuseAt <= 950) ? this._fuseCombo + 1 : 0;
    this._lastFuseAt = now;
    this.playFuse(this._fuseCombo + (scaled > 0.78 ? 1 : 0));
  }

  playMoveClick() {
    if (this._muted) return;
    const ctx = this._ensureRunning();
    const t0 = ctx.currentTime;

    this._tone({
      t0,
      freqFrom: jitter(300, 0.02),
      freqTo: 220,
      type: 'sine',
      attack: 0.007,
      release: 0.09,
      peak: 0.032,
      filter: 1200,
    });

    // Tiny noisy transient to feel less synthetic.
    this._noise({ t0, dur: 0.03, peak: 0.007, fromHz: 1600, toHz: 900 });
  }

  playInvalidSoft() {
    if (this._muted) return;
    const ctx = this._ensureRunning();
    const t0 = ctx.currentTime;

    this._tone({
      t0,
      freqFrom: jitter(195, 0.015),
      freqTo: 145,
      type: 'sine',
      attack: 0.012,
      release: 0.14,
      peak: 0.05,
      filter: 880,
    });
  }

  playFuse(comboIndex = 0) {
    if (this._muted) return;
    const ctx = this._ensureRunning();
    const t0 = ctx.currentTime;

    const idx = Math.max(0, comboIndex | 0) % NOTES.length;
    const base = NOTES[idx];

    this._tone({
      t0,
      freqFrom: jitter(base, 0.01),
      freqTo: base * 0.996,
      type: 'sine',
      attack: 0.01,
      release: 0.22,
      peak: 0.048,
      filter: 1800,
    });

    // Soft overtone for bell/pluck character.
    this._tone({
      t0,
      freqFrom: base * 2,
      freqTo: base * 1.85,
      type: 'triangle',
      attack: 0.004,
      release: 0.12,
      peak: 0.013,
      filter: 2400,
    });
  }

  playVictoryChord() {
    if (this._muted) return;
    const t0 = this._ensureRunning().currentTime;
    const chord = [NOTES[0], NOTES[1], NOTES[2]];

    chord.forEach((freq, i) => {
      this._tone({
        t0: t0 + i * 0.03,
        freqFrom: freq,
        freqTo: freq * 0.998,
        type: 'sine',
        attack: 0.02,
        release: 0.34,
        peak: 0.034,
        filter: 1700,
      });
    });
  }

  playShuffle() {
    if (this._muted) return;
    const t0 = this._ensureRunning().currentTime;

    this._noise({
      t0,
      dur: 0.15,
      peak: 0.022,
      fromHz: 1500,
      toHz: 480,
    });

    // Gentle body under the whoosh.
    this._tone({
      t0: t0 + 0.01,
      freqFrom: 240,
      freqTo: 180,
      type: 'sine',
      attack: 0.01,
      release: 0.12,
      peak: 0.012,
      filter: 850,
    });
  }

  mute() { this._muted = true; }
  unmute() { this._muted = false; }
  toggle() { this._muted = !this._muted; }

  setVolume(value) {
    this._sfxVolume = clamp01(value);
    if (this._sfxOut) this._sfxOut.gain.value = this._sfxVolume;
  }

  warmup() {
    try {
      this._ensureRunning();
    } catch (_) {}
  }

  _tone({ t0, freqFrom, freqTo, type, attack, release, peak, filter }) {
    const ctx = this._ensureRunning();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const lp = ctx.createBiquadFilter();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freqFrom), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqTo), t0 + Math.max(0.02, release));

    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(filter, t0);
    lp.Q.value = 0.55;

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + release);

    osc.connect(lp);
    lp.connect(gain);
    gain.connect(this._getSfxOutput(ctx));

    osc.start(t0);
    osc.stop(t0 + release + 0.02);
  }

  _noise({ t0, dur, peak, fromHz, toHz }) {
    const ctx = this._ensureRunning();
    const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.33;
    }

    const src = ctx.createBufferSource();
    const bp = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    src.buffer = buffer;

    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(fromHz, t0);
    bp.frequency.exponentialRampToValueAtTime(toHz, t0 + dur);
    bp.Q.value = 0.7;

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(bp);
    bp.connect(gain);
    gain.connect(this._getSfxOutput(ctx));

    src.start(t0);
    src.stop(t0 + dur + 0.01);
  }

  _ensureRunning() {
    const ctx = this._getContext();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  _getContext() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
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
}
