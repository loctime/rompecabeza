export class SfxBank {
  constructor(audioEngine) { this.audio = audioEngine; }

  playMove() { this._tone(420, 220, 0.08, 'sine', 0.12); }
  playFusion() {
    [523, 659, 784].forEach((f, i) => this._tone(f, f, 0.35, 'sine', 0.13, i * 0.04));
    this.audio.duckSfx();
  }
  playWin() { [523, 659, 784, 1046].forEach((f, i) => this._tone(f, f, 0.55, 'triangle', 0.15, i * 0.1)); }

  _tone(from, to, dur, type, gainAmount, offset = 0) {
    this.audio.warmup();
    const { ctx, sfx } = this.audio;
    if (!ctx || !sfx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, ctx.currentTime + offset);
    osc.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + offset + dur);
    gain.gain.setValueAtTime(gainAmount, ctx.currentTime + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + dur);
    osc.connect(gain);
    gain.connect(sfx);
    osc.start(ctx.currentTime + offset);
    osc.stop(ctx.currentTime + offset + dur);
  }
}
