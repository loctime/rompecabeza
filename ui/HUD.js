/**
 * ui/HUD.js
 *
 * Heads-Up Display: status text, win overlay, shuffle/replay buttons.
 * Zero game logic — receives data and updates DOM.
 */

export class HUD {
  /**
   * @param {object} config
   * @param {HTMLElement} config.statusEl
   * @param {HTMLElement} config.winEl
   * @param {HTMLElement} config.shuffleBtn
   * @param {HTMLElement} config.replayBtn
   * @param {number}      config.cols
   * @param {number}      config.rows
   */
  constructor({ statusEl, winEl, shuffleBtn, replayBtn, cols, rows }) {
    this.statusEl   = statusEl;
    this.winEl      = winEl;
    this.shuffleBtn = shuffleBtn;
    this.replayBtn  = replayBtn;
    this.cols      = cols;
    this.rows      = rows;
    this._shuffleFn = null;
    this._replayFn  = null;
    this._destroyed = false;
  }

  /**
   * Remueve listeners de botones. Llamar antes de reinicializar (p. ej. replay).
   */
  destroy() {
    if (this._destroyed) return;
    if (this._shuffleFn && this.shuffleBtn) {
      this.shuffleBtn.removeEventListener('click', this._shuffleFn);
      this._shuffleFn = null;
    }
    if (this._replayFn && this.replayBtn) {
      this.replayBtn.removeEventListener('click', this._replayFn);
      this._replayFn = null;
    }
    this.statusEl = this.winEl = this.shuffleBtn = this.replayBtn = null;
    this._destroyed = true;
  }

  /**
   * Update the status bar from current engine state.
   * @param {import('../engine/PuzzleEngine.js').PuzzleEngine} engine
   */
  update(engine) {
    const fused = engine.getFusedEdges().size;
    const total = engine.totalEdges;
    this.statusEl.textContent = `${fused}/${total} líneas fusionadas`;
  }

  showWin() {
    this.winEl.classList.add('show');
  }

  hideWin() {
    this.winEl.classList.remove('show');
  }

  /** @param {Function} fn */
  onShuffle(fn) {
    if (this._shuffleFn) this.shuffleBtn.removeEventListener('click', this._shuffleFn);
    this._shuffleFn = fn;
    this.shuffleBtn.addEventListener('click', this._shuffleFn);
  }

  /** @param {Function} fn */
  onReplay(fn) {
    if (this._replayFn) this.replayBtn.removeEventListener('click', this._replayFn);
    this._replayFn = fn;
    this.replayBtn.addEventListener('click', this._replayFn);
  }
}
