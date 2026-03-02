/** DragController: input mouse/touch desacoplado del dominio. */

export class DragController {
  constructor({ session, boardUI }) {
    this.session = session;
    this.boardUI = boardUI;
    this._drag = null;
    this._mmH = this._muH = this._tmH = this._teH = null;
    this._mdH = null;
    this._tsH = null;
    this._destroyed = false;
    this._bindBoardEvents();
  }

  destroy() {
    if (this._destroyed) return;
    this._removeListeners();
    if (this._mdH && this.boardUI?.wrapEl) this.boardUI.wrapEl.removeEventListener('mousedown', this._mdH);
    if (this._tsH && this.boardUI?.wrapEl) this.boardUI.wrapEl.removeEventListener('touchstart', this._tsH, { passive: false });
    this._destroyed = true;
  }

  _bindBoardEvents() {
    this._mdH = (e) => {
      const cell = e.target.closest('.cell');
      if (!cell) return;
      e.preventDefault();
      this._startDrag(e.clientX, e.clientY, parseInt(cell.dataset.pos, 10));
      window.addEventListener('mousemove', this._mmH = (ev) => this._onMove(ev.clientX, ev.clientY));
      window.addEventListener('mouseup', this._muH = (ev) => this._onUp(ev.clientX, ev.clientY));
    };
    this.boardUI.wrapEl.addEventListener('mousedown', this._mdH);

    this._tsH = (e) => {
      const cell = e.target.closest('.cell');
      if (!cell) return;
      e.preventDefault();
      const t = e.touches[0];
      this._startDrag(t.clientX, t.clientY, parseInt(cell.dataset.pos, 10));
      window.addEventListener('touchmove', this._tmH = (ev) => {
        ev.preventDefault();
        const touch = ev.touches[0];
        this._onMove(touch.clientX, touch.clientY);
      }, { passive: false });
      window.addEventListener('touchend', this._teH = (ev) => {
        const touch = ev.changedTouches[0];
        this._onUp(touch.clientX, touch.clientY);
      });
    };
    this.boardUI.wrapEl.addEventListener('touchstart', this._tsH, { passive: false });
  }

  _startDrag(cx, cy, pos) {
    const fused = this.session.getFusedEdges();
    const group = this.session.getGroup(pos, fused);
    const { ghostCanvas, minR, minC } = this.boardUI.buildGroupCanvas(group, this.session);
    const rect = this.boardUI.wrapEl.getBoundingClientRect();
    const ox = (cx - rect.left) - minC * this.boardUI.cellW;
    const oy = (cy - rect.top) - minR * this.boardUI.cellH;
    this.boardUI.startGhost(ghostCanvas, cx, cy, ox, oy);
    this.boardUI.dimGroup(group, true);
    this._drag = { group, originPos: pos, ox, oy };
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
    const { col, row } = this._ghostTopLeft(cx, cy);
    this._drag = null;
    this.session.applyMove(originPos, col, row);
  }

  _updateHover(cx, cy) {
    if (!this._drag) return;
    const { col, row } = this._ghostTopLeft(cx, cy);
    const { group } = this._drag;
    const cols = group.map((p) => p % this.session.state.cols);
    const rows = group.map((p) => Math.floor(p / this.session.state.cols));
    const minC = Math.min(...cols), minR = Math.min(...rows);
    const dc = col - minC, dr = row - minR;
    const positions = group.map((p) =>
      (Math.floor(p / this.session.state.cols) + dr) * this.session.state.cols + (p % this.session.state.cols + dc)
    );
    const valid = positions.every((np) => np >= 0 && np < this.session.state.total);
    this.boardUI.showHover(valid ? positions : [], this.session);
  }

  _ghostTopLeft(cx, cy) {
    const rect = this.boardUI.wrapEl.getBoundingClientRect();
    const bx = (cx - this._drag.ox) - rect.left;
    const by = (cy - this._drag.oy) - rect.top;
    return { col: Math.round(bx / this.boardUI.cellW), row: Math.round(by / this.boardUI.cellH) };
  }

  _removeListeners() {
    window.removeEventListener('mousemove', this._mmH);
    window.removeEventListener('mouseup', this._muH);
    window.removeEventListener('touchmove', this._tmH);
    window.removeEventListener('touchend', this._teH);
  }
}
