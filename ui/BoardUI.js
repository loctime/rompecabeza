export class BoardUI {
  constructor({ wrapEl, ghostEl, hoverEl, gridOverlayEl, boardW, boardH, cols, rows, hideBoardBorders = true }) {
    this.wrapEl = wrapEl;
    this.ghostEl = ghostEl;
    this.hoverEl = hoverEl;
    this.gridOverlayEl = gridOverlayEl;
    this.hideBoardBorders = hideBoardBorders;
    this.boardW = boardW;
    this.boardH = boardH;
    this.cols = cols;
    this.rows = rows;
    this.cellW = boardW / cols;
    this.cellH = boardH / rows;

    wrapEl.style.width = boardW + 'px';
    wrapEl.style.height = boardH + 'px';
    gridOverlayEl.width = boardW;
    gridOverlayEl.height = boardH;
    this._gctx = gridOverlayEl.getContext('2d');
    this._cellEls = [];
  }

  destroy() {
    if (this.wrapEl) {
      this.wrapEl.innerHTML = '';
    }
    if (this._gctx && this.gridOverlayEl) {
      this._gctx.clearRect(0, 0, this.gridOverlayEl.width, this.gridOverlayEl.height);
    }
    this._cellEls = [];
  }

  render(session, pieceCanvases, affected = null) {
    this._renderPieces(session, pieceCanvases, affected);
    this._renderGrid(session);
  }

  _ensureCell(pos) {
    let cell = this._cellEls[pos];
    if (!cell) {
      cell = document.createElement('div');
      cell.className = 'cell';
      const cv = document.createElement('canvas');
      cv.width = this.cellW;
      cv.height = this.cellH;
      cell.appendChild(cv);
      this.wrapEl.appendChild(cell);
      this._cellEls[pos] = cell;
    }
    return cell;
  }

  _renderPieces(session, pieceCanvases, affected = null) {
    const positions = affected || Array.from({ length: session.state.total }, (_, i) => i);
    positions.forEach((pos) => {
      const row = Math.floor(pos / session.state.cols);
      const col = pos % session.state.cols;
      const pieceId = session.state.board[pos];
      const pieceCanvas = pieceCanvases[pieceId];
      const cell = this._ensureCell(pos);
      cell.dataset.pos = String(pos);
      cell.style.cssText = `position:absolute;left:${col * this.cellW}px;top:${row * this.cellH}px;width:${this.cellW}px;height:${this.cellH}px;cursor:grab;user-select:none;`;
      const cv = cell.querySelector('canvas');
      if (cv && pieceCanvas) cv.getContext('2d').drawImage(pieceCanvas, 0, 0);
    });
  }

  _renderGrid(session) {
    this._gctx.clearRect(0, 0, this.boardW, this.boardH);
    if (this.hideBoardBorders) return;
    const fused = session.getFusedEdges();
    this._gctx.strokeStyle = '#000';
    this._gctx.lineWidth = 1;
    // Líneas verticales entre celdas no fusionadas (solo entre bloques no fusionados)
    for (let c = 1; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        const posL = r * this.cols + (c - 1);
        const posR = r * this.cols + c;
        if (fused.has(`${posL}:${posR}`)) continue;
        const x = Math.round(c * this.cellW) + 0.5;
        const y0 = Math.floor(r * this.cellH);
        const y1 = Math.ceil((r + 1) * this.cellH);
        this._gctx.beginPath();
        this._gctx.moveTo(x, y0);
        this._gctx.lineTo(x, y1);
        this._gctx.stroke();
      }
    }
    // Líneas horizontales entre celdas no fusionadas (evitar subpíxel en primera fila)
    for (let r = 1; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const posT = (r - 1) * this.cols + c;
        const posB = r * this.cols + c;
        if (fused.has(`${posT}:${posB}`)) continue;
        const y = Math.round(r * this.cellH) + 0.5;
        const x0 = Math.floor(c * this.cellW);
        const x1 = Math.ceil((c + 1) * this.cellW);
        this._gctx.beginPath();
        this._gctx.moveTo(x0, y);
        this._gctx.lineTo(x1, y);
        this._gctx.stroke();
      }
    }
  }

  buildGroupCanvas(group, session) {
    const rs = group.map((p) => Math.floor(p / session.state.cols));
    const cs = group.map((p) => p % session.state.cols);
    const minR = Math.min(...rs), minC = Math.min(...cs);
    const maxR = Math.max(...rs), maxC = Math.max(...cs);
    const cv = document.createElement('canvas');
    cv.width = (maxC - minC + 1) * this.cellW;
    cv.height = (maxR - minR + 1) * this.cellH;
    const ctx = cv.getContext('2d');
    group.forEach((pos) => {
      const r = Math.floor(pos / session.state.cols) - minR;
      const c = pos % session.state.cols - minC;
      const pieceId = session.state.board[pos];
      const source = this._pieceCanvases?.[pieceId];
      if (source) ctx.drawImage(source, c * this.cellW, r * this.cellH);
    });
    return { ghostCanvas: cv, minR, minC };
  }

  setPieceCanvases(pieceCanvases) { this._pieceCanvases = pieceCanvases; }
  _getBoardScale() {
    const container = this.wrapEl?.parentElement;
    if (!container) return 1;
    const s = getComputedStyle(container).getPropertyValue('--board-scale').trim();
    return s ? parseFloat(s) || 1 : 1;
  }
  startGhost(canvas, cx, cy, ox, oy) {
    const scale = this._getBoardScale();
    const w = canvas.width * scale;
    const h = canvas.height * scale;
    this.ghostEl.width = canvas.width;
    this.ghostEl.height = canvas.height;
    this.ghostEl.style.cssText = `display:block;width:${w}px;height:${h}px;`;
    this.ghostEl.getContext('2d').drawImage(canvas, 0, 0);
    this.moveGhost(cx, cy, ox, oy);
  }
  moveGhost(cx, cy, ox, oy) { this.ghostEl.style.left = (cx - ox) + 'px'; this.ghostEl.style.top = (cy - oy) + 'px'; }
  endGhost() { this.ghostEl.style.display = 'none'; }
  showHover(positions, session) { if (!positions.length) return this.clearHover(); const rs = positions.map((p) => Math.floor(p / session.state.cols)); const cs = positions.map((p) => p % session.state.cols); const minR = Math.min(...rs), minC = Math.min(...cs), maxR = Math.max(...rs), maxC = Math.max(...cs); const borderCss = this.hideBoardBorders ? 'border:none;box-shadow:none;' : 'border:2px solid rgba(255,255,255,0.4);box-shadow:inset 0 0 16px rgba(255,255,255,0.06);'; this.hoverEl.style.cssText = `display:block;position:absolute;left:${minC * this.cellW}px;top:${minR * this.cellH}px;width:${(maxC - minC + 1) * this.cellW}px;height:${(maxR - minR + 1) * this.cellH}px;pointer-events:none;z-index:11;${borderCss}`; }
  clearHover() { this.hoverEl.style.display = 'none'; }
  dimGroup(group, dim) { group.forEach((p) => { const el = this._cellEls[p]; if (el) el.style.opacity = dim ? '0.25' : ''; }); }
}
