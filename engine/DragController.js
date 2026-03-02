/**
 * engine/DragController.js
 *
 * Handles mouse and touch drag input.
 * Bridges PuzzleEngine (logic) ↔ BoardUI (rendering).
 */

export class DragController {
  constructor({ engine, boardUI, audio }) {
    this.engine  = engine;
    this.boardUI = boardUI;
    this.audio   = audio;
    this._drag   = null;
    this._mmH = this._muH = this._tmH = this._teH = null;
    this._mdH = null;
    this._tsH = null;
    this._destroyed = false;

    this._bindBoardEvents();
  }

  /**
   * Remueve todos los listeners. Llamar antes de reinicializar la app (p. ej. replay).
   */
  destroy() {
    if (this._destroyed) return;
    this._removeListeners();
    if (this._mdH && this.boardUI?.wrapEl) {
      this.boardUI.wrapEl.removeEventListener('mousedown', this._mdH);
      this._mdH = null;
    }
    if (this._tsH && this.boardUI?.wrapEl) {
      this.boardUI.wrapEl.removeEventListener('touchstart', this._tsH, { passive: false });
      this._tsH = null;
    }
    this.engine = null;
    this.boardUI = null;
    this.audio = null;
    this._destroyed = true;
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _bindBoardEvents() {
    this._mdH = (e) => {
      const cell = e.target.closest('.cell');
      if (!cell) return;
      e.preventDefault();
      this._startDrag(e.clientX, e.clientY, parseInt(cell.dataset.pos));
      window.addEventListener('mousemove', this._mmH = ev => this._onMove(ev.clientX, ev.clientY));
      window.addEventListener('mouseup',   this._muH = ev => this._onUp(ev.clientX, ev.clientY));
    };
    this.boardUI.wrapEl.addEventListener('mousedown', this._mdH);

    this._tsH = (e) => {
      const cell = e.target.closest('.cell');
      if (!cell) return;
      e.preventDefault();
      const t = e.touches[0];
      this._startDrag(t.clientX, t.clientY, parseInt(cell.dataset.pos));
      window.addEventListener('touchmove', this._tmH = ev => {
        ev.preventDefault();
        const t = ev.touches[0];
        this._onMove(t.clientX, t.clientY);
      }, { passive: false });
      window.addEventListener('touchend', this._teH = ev => {
        const t = ev.changedTouches[0];
        this._onUp(t.clientX, t.clientY);
      });
    };
    this.boardUI.wrapEl.addEventListener('touchstart', this._tsH, { passive: false });
  }

  _startDrag(cx, cy, pos) {
    const fused  = this.engine.getFusedEdges();
    const group  = this.engine.getGroup(pos, fused);
    const { ghostCanvas, minR, minC } = this.boardUI.buildGroupCanvas(group, this.engine);

    const rect = this.boardUI.wrapEl.getBoundingClientRect();
    const ox   = (cx - rect.left) - minC * this.engine.cellW;
    const oy   = (cy - rect.top)  - minR * this.engine.cellH;

    this.boardUI.startGhost(ghostCanvas, cx, cy, ox, oy);
    this.boardUI.dimGroup(group, true);

    this._drag = { group, originPos: pos, ox, oy, gMinC: minC, gMinR: minR };
  }

  _onMove(cx, cy) {
    if (!this._drag) return;
    this.boardUI.moveGhost(cx, cy, this._drag.ox, this._drag.oy);
    this._updateHover(cx, cy);
  }

  _onUp(cx, cy) {
    this._removeListeners();
    if (!this._drag) return;

    const { group, originPos } = this._drag;
    this.boardUI.dimGroup(group, false);
    this.boardUI.endGhost();
    this.boardUI.clearHover();

    // Destination col/row = where ghost top-left snaps
    const { col: rawCol, row: rawRow } = this._ghostTopLeft(cx, cy);

    // Clamp so group stays in bounds
    const groupCols = group.map(p => p % this.engine.cols);
    const groupRows = group.map(p => Math.floor(p / this.engine.cols));
    const gMinC = Math.min(...groupCols), gMinR = Math.min(...groupRows);
    const spanC = Math.max(...groupCols) - gMinC;
    const spanR = Math.max(...groupRows) - gMinR;
    const finalCol = Math.max(0, Math.min(this.engine.cols - 1 - spanC, rawCol));
    const finalRow = Math.max(0, Math.min(this.engine.rows - 1 - spanR, rawRow));

    this._drag = null;
    this.engine.applyMove(originPos, finalCol, finalRow);
  }

  _updateHover(cx, cy) {
    if (!this._drag) return;
    const { col: rawCol, row: rawRow } = this._ghostTopLeft(cx, cy);
    const { group } = this._drag;

    const groupCols = group.map(p => p % this.engine.cols);
    const groupRows = group.map(p => Math.floor(p / this.engine.cols));
    const gMinC = Math.min(...groupCols), gMinR = Math.min(...groupRows);
    const dc = rawCol - gMinC, dr = rawRow - gMinR;

    const newPos = group.map(p =>
      (Math.floor(p / this.engine.cols) + dr) * this.engine.cols + (p % this.engine.cols + dc)
    );

    const valid = newPos.every(np => {
      if (np < 0 || np >= this.engine.total) return false;
      const nr = Math.floor(np / this.engine.cols), nc = np % this.engine.cols;
      return nr >= 0 && nr < this.engine.rows && nc >= 0 && nc < this.engine.cols;
    });

    this.boardUI.showHover(valid ? newPos : [], this.engine);
  }

  _ghostTopLeft(cx, cy) {
    const rect = this.boardUI.wrapEl.getBoundingClientRect();
    const bx   = (cx - this._drag.ox) - rect.left;
    const by   = (cy - this._drag.oy) - rect.top;
    return {
      col: Math.round(bx / this.engine.cellW),
      row: Math.round(by / this.engine.cellH),
    };
  }

  _removeListeners() {
    window.removeEventListener('mousemove', this._mmH);
    window.removeEventListener('mouseup',   this._muH);
    window.removeEventListener('touchmove', this._tmH);
    window.removeEventListener('touchend',  this._teH);
  }
}
