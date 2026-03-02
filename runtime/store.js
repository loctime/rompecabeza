import { getSetting, setSetting, getProgress, setProgress } from '../storage/persistence.js';

export class AppStore {
  constructor() {
    this.state = {
      settings: { mute: false, theme: 'dark', musicVolume: 0.6, sfxVolume: 0.9 },
      progress: {},
      statsByLevel: {},
      uiPrefs: { mode: 'classic', levelId: 'mountain-night' },
    };
    this.listeners = new Set();
  }

  async hydrate() {
    this.state.settings = {
      mute: await getSetting('mute', false),
      theme: await getSetting('theme', 'dark'),
      musicVolume: await getSetting('musicVolume', 0.6),
      sfxVolume: await getSetting('sfxVolume', 0.9),
    };
    const progress = await getProgress('all-levels');
    if (progress) this.state.progress = progress;
    this.emit();
  }

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { this.listeners.forEach((fn) => fn(this.state)); }

  async setSetting(key, value) {
    this.state.settings[key] = value;
    await setSetting(key, value);
    this.emit();
  }

  async markLevelResult(levelId, result) {
    this.state.progress[levelId] = { ...(this.state.progress[levelId] || {}), ...result };
    await setProgress('all-levels', this.state.progress);
    this.emit();
  }
}
