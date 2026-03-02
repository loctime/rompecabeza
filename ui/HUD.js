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
    this.statusEl  = statusEl;
    this.winEl     = winEl;
    this.shuffleBtn = shuffleBtn;
    this.replayBtn  = replayBtn;
    this.cols = cols;
    this.rows = rows;
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
    this.shuffleBtn.addEventListener('click', fn);
  }

  /** @param {Function} fn */
  onReplay(fn) {
    this.replayBtn.addEventListener('click', fn);
  }
}
