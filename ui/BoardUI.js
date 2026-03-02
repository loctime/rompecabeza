/**
 * ui/BoardUI.js
 *
 * Handles all visual rendering of the puzzle board.
 * Receives engine state and renders it — zero game logic here.
 *
 * Responsibilities:
 *  - Render piece canvases as absolutely-positioned .cell divs
 *  - Draw / clear grid lines on the overlay canvas
 *  - Manage ghost (drag preview) canvas
 *  - Show / hide hover highlight
 *  - Dim / undim dragged group
 */

export class BoardUI {
  /**
   * @param {object} config
   * @param {HTMLElement}       config.wrapEl
   * @param {HTMLCanvasElement} config.ghostEl
   * @param {HTMLElement}       config.hoverEl
   * @param {HTMLCanvasElement} config.gridOverlayEl
   * @param {number} config.boardW
   * @param {number} config.boardH
   * @param {number} config.cols
   * @param {number} config.rows
   */
  constructor({ wrapEl, ghostEl, hoverEl, gridOverlayEl, boardW, boardH, cols, rows }) {
    this.wrapEl        = wrapEl;
    this.ghostEl       = ghostEl;
    this.hoverEl       = hoverEl;
    this.gridOverlayEl = gridOverlayEl;
    this.boardW        = boardW;
    this.boardH        = boardH;
    this.cols          = cols;
    this.rows          = rows;
    this.cellW         = boardW / cols;
    this.cellH         = boardH / rows;

    // Size the board wrap and overlay
    wrapEl.style.width  = boardW + 'px';
    wrapEl.style.height = boardH + 'px';
    gridOverlayEl.width  = boardW;
    gridOverlayEl.height = boardH;

    this._gctx = gridOverlayEl.getContext('2d');
  }

  // ── Full render ─────────────────────────────────────────────────────────────

  /**
   * Full board render. Call after any engine state change.
   * @param {import('../engine/PuzzleEngine.js').PuzzleEngine} engine
   */
  render(engine) {
    this._renderPieces(engine);
    this._renderGrid(engine);
  }

  // ── Ghost (drag preview) ────────────────────────────────────────────────────

  /**
   * Build a composite canvas for a group of pieces.
   * @returns {{ ghostCanvas, minR, minC }}
   */
  buildGroupCanvas(group, engine) {
    const rs   = group.map(p => Math.floor(p / engine.cols));
    const cs   = group.map(p => p % engine.cols);
    const minR = Math.min(...rs), minC = Math.min(...cs);
    const maxR = Math.max(...rs), maxC = Math.max(...cs);
    const W    = (maxC - minC + 1) * this.cellW;
    const H    = (maxR - minR + 1) * this.cellH;

    const cv  = document.createElement('canvas');
    cv.width  = W; cv.height = H;
    const ctx = cv.getContext('2d');

    group.forEach(pos => {
      const r = Math.floor(pos / engine.cols) - minR;
      const c = pos % engine.cols - minC;
      ctx.drawImage(engine.pieces[engine.board[pos]].canvas, c * this.cellW, r * this.cellH);
    });

    return { ghostCanvas: cv, minR, minC };
  }

  startGhost(canvas, cx, cy, ox, oy) {
    this.ghostEl.width  = canvas.width;
    this.ghostEl.height = canvas.height;
    this.ghostEl.style.cssText = `display:block;width:${canvas.width}px;height:${canvas.height}px;`;
    this.ghostEl.getContext('2d').drawImage(canvas, 0, 0);
    this.moveGhost(cx, cy, ox, oy);
  }

  moveGhost(cx, cy, ox, oy) {
    this.ghostEl.style.left = (cx - ox) + 'px';
    this.ghostEl.style.top  = (cy - oy) + 'px';
  }

  endGhost() {
    this.ghostEl.style.display = 'none';
  }

  // ── Hover highlight ─────────────────────────────────────────────────────────

  /**
   * Highlight the cells where the dragged group would land.
   * @param {number[]} positions — board positions to highlight (empty = hide)
   */
  showHover(positions, engine) {
    if (!positions.length) { this.clearHover(); return; }
    const rs   = positions.map(p => Math.floor(p / engine.cols));
    const cs   = positions.map(p => p % engine.cols);
    const minR = Math.min(...rs), minC = Math.min(...cs);
    const maxR = Math.max(...rs), maxC = Math.max(...cs);
    const W    = (maxC - minC + 1) * this.cellW;
    const H    = (maxR - minR + 1) * this.cellH;
    this.hoverEl.style.cssText = `
      display:block;
      position:absolute;
      left:${minC * this.cellW}px;
      top:${minR * this.cellH}px;
      width:${W}px;
      height:${H}px;
      pointer-events:none;
      z-index:11;
      border:2px solid #c9a84c;
      box-shadow:inset 0 0 16px rgba(201,168,76,0.12);
    `;
  }

  clearHover() {
    this.hoverEl.style.display = 'none';
  }

  // ── Group dim ───────────────────────────────────────────────────────────────

  dimGroup(group, dim) {
    group.forEach(p => {
      const el = this.wrapEl.querySelector(`.cell[data-pos="${p}"]`);
      if (el) el.style.opacity = dim ? '0.25' : '';
    });
  }

  // ── Private rendering ───────────────────────────────────────────────────────

  _renderPieces(engine) {
    this.wrapEl.querySelectorAll('.cell').forEach(e => e.remove());
    for (let pos = 0; pos < engine.total; pos++) {
      const row  = Math.floor(pos / engine.cols);
      const col  = pos % engine.cols;
      const cell = document.createElement('div');
      cell.className  = 'cell';
      cell.dataset.pos = pos;
      cell.style.cssText = `
        position:absolute;
        left:${col * this.cellW}px;
        top:${row * this.cellH}px;
        width:${this.cellW}px;
        height:${this.cellH}px;
        cursor:grab;
        user-select:none;
      `;
      const cv  = document.createElement('canvas');
      cv.width  = this.cellW;
      cv.height = this.cellH;
      cv.getContext('2d').drawImage(engine.pieces[engine.board[pos]].canvas, 0, 0);
      cell.appendChild(cv);
      this.wrapEl.appendChild(cell);
    }
  }

  _renderGrid(engine) {
    const fused = engine.getFusedEdges();
    this._gctx.clearRect(0, 0, this.boardW, this.boardH);
    this._gctx.strokeStyle = 'rgba(201,168,76,0.3)';
    this._gctx.lineWidth   = 1;

    // Vertical inner lines
    for (let c = 1; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        const posL = r * this.cols + (c - 1);
        const posR = r * this.cols + c;
        if (fused.has(`${posL}:${posR}`)) continue;
        const x = c * this.cellW;
        this._gctx.beginPath();
        this._gctx.moveTo(x, r * this.cellH);
        this._gctx.lineTo(x, (r + 1) * this.cellH);
        this._gctx.stroke();
      }
    }

    // Horizontal inner lines
    for (let r = 1; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const posT = (r - 1) * this.cols + c;
        const posB = r * this.cols + c;
        if (fused.has(`${posT}:${posB}`)) continue;
        const y = r * this.cellH;
        this._gctx.beginPath();
        this._gctx.moveTo(c * this.cellW, y);
        this._gctx.lineTo((c + 1) * this.cellW, y);
        this._gctx.stroke();
      }
    }
  }
}
