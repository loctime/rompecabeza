export class MusicController {
  constructor(audioEngine) {
    this.audio = audioEngine;
    this.osc = null;
  }

  startAmbient() {
    this.audio.warmup();
    const { ctx, music } = this.audio;
    if (!ctx || !music || this.osc) return;
    this.osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();

    this.osc.type = 'triangle';
    this.osc.frequency.value = 120;
    lfo.frequency.value = 0.1;
    lfoGain.gain.value = 12;
    lfo.connect(lfoGain);
    lfoGain.connect(this.osc.frequency);
    this.osc.connect(music);
    lfo.start();
    this.osc.start();
    this._lfo = lfo;
  }

  stopAmbient() {
    if (this.osc) { this.osc.stop(); this.osc.disconnect(); this.osc = null; }
    if (this._lfo) { this._lfo.stop(); this._lfo.disconnect(); this._lfo = null; }
  }
}
