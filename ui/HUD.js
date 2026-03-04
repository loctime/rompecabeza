export class HUD {
  constructor({ statusEl, winEl, shuffleBtn, replayBtn, nextLevelBtn, levelsBtn, downloadBtn, winStatsEl }) {
    this.statusEl = statusEl;
    this.winEl = winEl;
    this.shuffleBtn = shuffleBtn;
    this.replayBtn = replayBtn;
    this.nextLevelBtn = nextLevelBtn;
    this.levelsBtn = levelsBtn;
    this.downloadBtn = downloadBtn;
    this.winStatsEl = winStatsEl;
  }

  update(snapshot) {
    if (!this.statusEl) return;
    const seconds = Math.floor(snapshot.elapsedMs / 1000);
    this.statusEl.textContent = `${snapshot.fusedEdges}/${snapshot.totalEdges} fusionadas · mov:${snapshot.moveCount} · t:${seconds}s · score:${snapshot.score}`;
  }

  showWin() { this.winEl.classList.add('show'); }
  hideWin() { this.winEl.classList.remove('show'); }

  /** Oculta status y botón mezclar (HUD de juego) para la secuencia AAA. */
  hideGameHUD() {
    if (this.statusEl) this.statusEl.style.visibility = 'hidden';
    if (this.shuffleBtn) this.shuffleBtn.style.visibility = 'hidden';
  }

  /** Muestra de nuevo el HUD de juego. */
  showGameHUD() {
    if (this.statusEl) this.statusEl.style.visibility = '';
    if (this.shuffleBtn) this.shuffleBtn.style.visibility = '';
  }

  /**
   * Muestra el banner de completado con stats y CTAs (después de la cinemática).
   * options = { hasNextLevel, onNextLevel, onReplay, onLevels, onDownload }
   */
  showCompletionBanner(stats, options = {}) {
    if (this.winStatsEl) {
      const sec = Math.floor((stats.elapsedMs || 0) / 1000);
      this.winStatsEl.textContent = `Movimientos: ${stats.moveCount ?? 0} · Tiempo: ${sec}s · Puntos: ${stats.score ?? 0}`;
    }
    if (this.nextLevelBtn) {
      this.nextLevelBtn.style.display = options.hasNextLevel ? '' : 'none';
      this.nextLevelBtn.onclick = options.onNextLevel || null;
    }
    if (this.replayBtn) this.replayBtn.onclick = () => options.onReplay?.();
    if (this.levelsBtn) this.levelsBtn.onclick = () => options.onLevels?.();
    if (this.downloadBtn) this.downloadBtn.onclick = () => options.onDownload?.();
    this.winEl.classList.add('show');
  }

  onShuffle(fn) { if (this.shuffleBtn) this.shuffleBtn.onclick = fn; }
  onReplay(fn) { if (this.replayBtn) this.replayBtn.onclick = fn; }
}
