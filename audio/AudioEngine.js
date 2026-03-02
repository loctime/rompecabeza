export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.music = null;
    this.sfx = null;
    this._muted = false;
  }

  warmup() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.music = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.music.connect(this.master);
      this.sfx.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.music.gain.value = 0.6;
      this.sfx.gain.value = 0.9;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setMuted(m) {
    this._muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 1;
  }
  setMusicVolume(v) { if (this.music) this.music.gain.value = v; }
  setSfxVolume(v) { if (this.sfx) this.sfx.gain.value = v; }

  duckSfx(ms = 180) {
    if (!this.music || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.music.gain.cancelScheduledValues(t);
    this.music.gain.setValueAtTime(this.music.gain.value, t);
    this.music.gain.linearRampToValueAtTime(Math.max(0.2, this.music.gain.value * 0.7), t + 0.04);
    this.music.gain.linearRampToValueAtTime(0.6, t + ms / 1000);
  }
}
