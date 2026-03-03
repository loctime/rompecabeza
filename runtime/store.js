import { ProgressRepository, SettingsRepository } from '../storage/persistence.js';

export class AppStore {
  constructor(userId = 'default') {
    this.userId = userId;
    this.settingsRepo = new SettingsRepository(userId);
    this.progressRepo = new ProgressRepository(userId);
    this.state = {
      settings: { mute: false, theme: 'dark', musicVolume: 0.6, sfxVolume: 0.9, hideBoardBorders: true },
      progress: {},
      statsByLevel: {},
      uiPrefs: { mode: 'classic', levelId: 'mountain-night' },
    };
    this.listeners = new Set();
  }

  setUser(userId) {
    this.userId = userId;
    this.settingsRepo = new SettingsRepository(userId);
    this.progressRepo = new ProgressRepository(userId);
  }

  async hydrate() {
    this.state.settings = {
      mute: await this.settingsRepo.get('mute', false),
      theme: await this.settingsRepo.get('theme', 'dark'),
      musicVolume: await this.settingsRepo.get('musicVolume', 0.6),
      sfxVolume: await this.settingsRepo.get('sfxVolume', 0.9),
      hideBoardBorders: await this.settingsRepo.get('hideBoardBorders', true),
    };
    this.state.progress = await this.progressRepo.getSummaryByLevel();
    this.emit();
  }

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { this.listeners.forEach((fn) => fn(this.state)); }

  async setSetting(key, value) {
    this.state.settings[key] = value;
    await this.settingsRepo.set(key, value);
    this.emit();
  }

  async markLevelResult(levelId, mode, result) {
    const prev = this.state.progress[levelId] || {};
    this.state.progress[levelId] = { ...prev, ...result, lastMode: mode };
    await this.progressRepo.upsertLevelMode(levelId, mode, {
      bestScore: Math.max(prev.bestScore || 0, result.bestScore || 0),
      stars: result.solved ? 1 : 0,
      dirty: true,
    });
    this.emit();
  }
}
