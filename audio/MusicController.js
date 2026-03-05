const TRACKS = {
  home: 'audio/music/home.mp3',
  daily: 'audio/music/daily.mp3',
  classic: 'audio/music/classic.mp3',
  infinite: 'audio/music/infinite.mp3',
};

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

export class MusicController {
  constructor({ fadeMs = 700, volume = 0.6 } = {}) {
    this.fadeMs = Math.max(120, fadeMs);
    this.volume = clamp01(volume);
    this.currentSection = null;
    this.currentAudio = null;
    this._tracks = new Map();
    this._fadeToken = 0;
    this._pendingSection = null;
    this._initialized = false;
  }

  init() {
    if (this._initialized) return;
    Object.entries(TRACKS).forEach(([section, src]) => {
      const audio = new Audio(src);
      audio.loop = true;
      audio.preload = 'auto';
      audio.volume = 0;
      this._tracks.set(section, audio);
    });

    const unlock = () => {
      const pending = this._pendingSection;
      if (pending) this.play(pending);
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });

    this._initialized = true;
  }

  play(section) {
    const next = this._getTrack(section);
    if (!next) return;
    if (this.currentSection === section && this.currentAudio === next && !next.paused) return;

    this._fadeToken += 1;
    if (this.currentAudio && this.currentAudio !== next) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
    }

    this.currentSection = section;
    this.currentAudio = next;
    next.volume = this.volume;
    this._playElement(next, section);
  }

  fadeTo(section) {
    const next = this._getTrack(section);
    if (!next) return;
    if (this.currentSection === section && this.currentAudio === next && !next.paused) return;

    const from = this.currentAudio;
    this.currentSection = section;
    this.currentAudio = next;

    if (!from || from === next || from.paused) {
      next.volume = this.volume;
      this._fadeToken += 1;
      this._playElement(next, section);
      return;
    }

    this._crossfade(from, next, section);
  }

  stop() {
    this._fadeToken += 1;
    this._pendingSection = null;
    this._tracks.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 0;
    });
    this.currentAudio = null;
    this.currentSection = null;
  }

  setVolume(value) {
    this.volume = clamp01(value);
    if (this.currentAudio && !this.currentAudio.paused) {
      this.currentAudio.volume = this.volume;
    }
  }

  _getTrack(section) {
    if (!this._initialized) this.init();
    return this._tracks.get(section) || null;
  }

  _playElement(audio, section) {
    const promise = audio.play();
    if (!promise || typeof promise.catch !== 'function') return;
    promise.catch(() => {
      this._pendingSection = section;
    });
  }

  _crossfade(from, to, section) {
    this._fadeToken += 1;
    const token = this._fadeToken;
    to.volume = 0;
    const startTime = performance.now();
    const fromStartVolume = from.volume;

    this._playElement(to, section);

    const step = (now) => {
      if (token !== this._fadeToken) return;
      const t = Math.min(1, (now - startTime) / this.fadeMs);
      from.volume = fromStartVolume * (1 - t);
      to.volume = this.volume * t;
      if (t < 1) {
        requestAnimationFrame(step);
        return;
      }
      from.pause();
      from.currentTime = 0;
      from.volume = 0;
      to.volume = this.volume;
    };
    requestAnimationFrame(step);
  }
}
