// ── Timing/easing: ajustar duraciones (ms) y zoom para la secuencia AAA ─────────────────
const SNAP_DURATION_MS = 180;
const BOUNCE_DURATION_MS = 120;
const ALIGN_DURATION_MS = 80;
const FREEZE_BEFORE_CAMERA_MS = 400;  // Pausa breve antes del zoom (más fluido)
const CAMERA_DURATION_MS = 1800;      // Zoom suave y adictivo
const CAMERA_ZOOM_FACTOR = 1.06;      // Zoom sutil en el lugar
const DRIFT_OFFSET_PX = 3;
const PARTICLE_DURATION_MS = 1000;
const PARTICLE_COUNT = 24;

function easeOutCubic(t) { return 1 - (1 - t) ** 3; }
function easeOutQuart(t) { return 1 - (1 - t) ** 4; }
function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2; }

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
    this._cinematicMode = false;
  }

  /** Deshabilita pointer events en el tablero y oculta artefactos de UI del board. */
  setCinematicMode(enabled) {
    this._cinematicMode = !!enabled;
    if (this.wrapEl) this.wrapEl.style.pointerEvents = enabled ? 'none' : '';
  }

  /**
   * Ejecuta la secuencia AAA; al terminar resuelve la Promise.
   * context = { lastPieceId?, lastPlacedPieceIds?, lastPlacedPositions? }. Si no hay lastPlacedPositions, se usan lastPlacedPieceIds (en tablero resuelto, pieceId i está en pos i).
   */
  playCompletionAAA(stats, context = {}) {
    const positions = context.lastPlacedPositions ?? (context.lastPlacedPieceIds || []).map((id) => id);
    return new Promise((resolve) => {
      const steps = () => {
        this._step1SnapBounce(positions, () => {
          this._step2AlignAll(() => {
            this._step3HideGrid(() => {
              this._stepFreeze(() => {
                this._step4Camera(() => {
                  this._stepParticles(resolve);
                });
              });
            });
          });
        });
      };
      steps();
    });
  }

  _step1SnapBounce(lastPlacedPositions, done) {
    if (!lastPlacedPositions.length) {
      setTimeout(done, SNAP_DURATION_MS + BOUNCE_DURATION_MS);
      return;
    }
    const cells = lastPlacedPositions.map((pos) => this._cellEls[pos]).filter(Boolean);
    if (!cells.length) {
      setTimeout(done, SNAP_DURATION_MS + BOUNCE_DURATION_MS);
      return;
    }
    cells.forEach((el) => {
      el.style.transform = `translate(${DRIFT_OFFSET_PX}px, ${DRIFT_OFFSET_PX}px)`;
      el.style.transition = 'none';
    });
    requestAnimationFrame(() => {
      cells.forEach((el) => {
        el.style.transition = `transform ${SNAP_DURATION_MS}ms cubic-bezier(0.25, 0.1, 0.25, 1)`;
        el.style.transform = 'translate(0,0)';
      });
    });
    setTimeout(() => {
      cells.forEach((el) => {
        el.style.transition = `transform ${BOUNCE_DURATION_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
        el.style.transform = 'scale(1.02)';
      });
      requestAnimationFrame(() => {
        cells.forEach((el) => {
          el.style.transform = 'scale(1)';
        });
      });
    }, SNAP_DURATION_MS);
    setTimeout(done, SNAP_DURATION_MS + BOUNCE_DURATION_MS);
  }

  _step2AlignAll(done) {
    const tol = 1;
    let needsAlign = false;
    for (let pos = 0; pos < this._cellEls.length; pos++) {
      const cell = this._cellEls[pos];
      if (!cell) continue;
      const col = pos % this.cols;
      const row = Math.floor(pos / this.cols);
      const wantLeft = col * this.cellW;
      const wantTop = row * this.cellH;
      const style = cell.style;
      const curLeft = parseFloat(style.left) || 0;
      const curTop = parseFloat(style.top) || 0;
      if (Math.abs(curLeft - wantLeft) > tol || Math.abs(curTop - wantTop) > tol) {
        style.left = wantLeft + 'px';
        style.top = wantTop + 'px';
        style.transform = '';
        needsAlign = true;
      }
    }
    setTimeout(done, ALIGN_DURATION_MS);
  }

  _step3HideGrid(done) {
    if (this.hoverEl) this.hoverEl.style.display = 'none';
    if (this._gctx && this.gridOverlayEl) {
      this._gctx.clearRect(0, 0, this.gridOverlayEl.width, this.gridOverlayEl.height);
    }
    this.gridOverlayEl.style.display = 'none';
    setTimeout(done, 50);
  }

  /** Freeze breve (Plan Maestro / Extras: imagen visible antes del zoom). Ajustar en FREEZE_BEFORE_CAMERA_MS. */
  _stepFreeze(done) {
    setTimeout(done, FREEZE_BEFORE_CAMERA_MS);
  }

  /**
   * Zoom suave en el lugar: se anima el contenedor (no el wrap) para no tocar
   * la escala actual del tablero y evitar el “achique” previo. Origen al centro.
   */
  _step4Camera(done) {
    const start = performance.now();
    const wrap = this.wrapEl;
    const container = wrap?.parentElement;
    if (!wrap || !container) {
      done();
      return;
    }
    container.style.transformOrigin = '50% 50%';
    container.style.transform = 'scale(1)';
    const tick = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(1, elapsed / CAMERA_DURATION_MS);
      const eased = easeOutQuart(t);
      const scale = 1 + (CAMERA_ZOOM_FACTOR - 1) * eased;
      container.style.transform = `scale(${scale})`;
      if (t < 1) requestAnimationFrame(tick);
      else done();
    };
    requestAnimationFrame(tick);
  }

  /** Partículas suaves tras el zoom (Extras punto 9). Ajustar PARTICLE_DURATION_MS y PARTICLE_COUNT. */
  _stepParticles(done) {
    const container = this.wrapEl?.parentElement;
    if (!container) {
      done();
      return;
    }
    const w = this.boardW;
    const h = this.boardH;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${h}px;pointer-events:none;z-index:12;`;
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const cx = w / 2;
    const cy = h / 2;
    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      angle: (Math.PI * 2 * Math.random()),
      dist: 0,
      maxDist: 20 + Math.random() * 60,
      size: 1.5 + Math.random() * 2,
      opacity: 0.4 + Math.random() * 0.5,
    }));
    const start = performance.now();
    const tick = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(1, elapsed / PARTICLE_DURATION_MS);
      ctx.clearRect(0, 0, w, h);
      particles.forEach((p) => {
        const dist = p.maxDist * easeOutCubic(t);
        const x = cx + Math.cos(p.angle) * dist;
        const y = cy + Math.sin(p.angle) * dist;
        const opacity = p.opacity * (1 - t);
        ctx.fillStyle = `rgba(201, 168, 76, ${opacity})`;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      if (t < 1) requestAnimationFrame(tick);
      else {
        canvas.remove();
        done();
      }
    };
    requestAnimationFrame(tick);
  }

  /** Devuelve data URL PNG del tablero resuelto (pieza i en celda i). */
  exportSolvedImage() {
    if (!this._pieceCanvases) return null;
    const canvas = document.createElement('canvas');
    canvas.width = this.boardW;
    canvas.height = this.boardH;
    const ctx = canvas.getContext('2d');
    for (let pos = 0; pos < this.cols * this.rows; pos++) {
      const col = pos % this.cols;
      const row = Math.floor(pos / this.cols);
      const pieceCanvas = this._pieceCanvases[pos];
      if (pieceCanvas) ctx.drawImage(pieceCanvas, col * this.cellW, row * this.cellH);
    }
    return canvas.toDataURL('image/png');
  }

  destroy() {
    const container = this.wrapEl?.parentElement;
    if (container) {
      container.style.transform = '';
      container.style.transformOrigin = '';
    }
    if (this.gridOverlayEl) this.gridOverlayEl.style.display = '';
    if (this.wrapEl) {
      this.wrapEl.style.pointerEvents = '';
      this.wrapEl.style.transform = '';
      this.wrapEl.style.transformOrigin = '';
      this.wrapEl.querySelectorAll('.cell').forEach((el) => el.remove());
    }
    if (this.hoverEl) this.hoverEl.style.display = 'none';
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
    const { cols, rows, total } = session.state;

    // 1) Líneas finas entre celdas no fusionadas (con margen para que no se toquen)
    const sepInset = 2;
    this._gctx.strokeStyle = '#000';
    this._gctx.lineWidth = 1;
    for (let c = 1; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        const posL = r * this.cols + (c - 1);
        const posR = r * this.cols + c;
        if (fused.has(`${posL}:${posR}`)) continue;
        const x = Math.round(c * this.cellW) + 0.5;
        const y0 = Math.floor(r * this.cellH);
        const y1 = Math.ceil((r + 1) * this.cellH);
        const ya = y0 + sepInset;
        const yb = y1 - sepInset;
        if (ya < yb) {
          this._gctx.beginPath();
          this._gctx.moveTo(x, ya);
          this._gctx.lineTo(x, yb);
          this._gctx.stroke();
        }
      }
    }
    for (let r = 1; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const posT = (r - 1) * this.cols + c;
        const posB = r * this.cols + c;
        if (fused.has(`${posT}:${posB}`)) continue;
        const y = Math.round(r * this.cellH) + 0.5;
        const x0 = Math.floor(c * this.cellW);
        const x1 = Math.ceil((c + 1) * this.cellW);
        const xa = x0 + sepInset;
        const xb = x1 - sepInset;
        if (xa < xb) {
          this._gctx.beginPath();
          this._gctx.moveTo(xa, y);
          this._gctx.lineTo(xb, y);
          this._gctx.stroke();
        }
      }
    }

    // 2) Contorno grueso para cada bloque fusionado (2+ celdas)
    const seen = new Set();
    const groups = [];
    for (let pos = 0; pos < total; pos++) {
      if (seen.has(pos)) continue;
      const group = session.getGroup(pos, fused);
      group.forEach((p) => seen.add(p));
      if (group.length >= 2) groups.push(group);
    }
    this._gctx.strokeStyle = '#c9a84c';
    this._gctx.lineWidth = 3;
    for (const group of groups) {
      const set = new Set(group);
      for (const pos of group) {
        const r = Math.floor(pos / cols);
        const c = pos % cols;
        const x0 = c * this.cellW;
        const y0 = r * this.cellH;
        const x1 = (c + 1) * this.cellW;
        const y1 = (r + 1) * this.cellH;
        if (c === 0 || !set.has(pos - 1)) {
          this._gctx.beginPath();
          this._gctx.moveTo(x0, y0);
          this._gctx.lineTo(x0, y1);
          this._gctx.stroke();
        }
        if (c === cols - 1 || !set.has(pos + 1)) {
          this._gctx.beginPath();
          this._gctx.moveTo(x1, y0);
          this._gctx.lineTo(x1, y1);
          this._gctx.stroke();
        }
        if (r === 0 || !set.has(pos - cols)) {
          this._gctx.beginPath();
          this._gctx.moveTo(x0, y0);
          this._gctx.lineTo(x1, y0);
          this._gctx.stroke();
        }
        if (r === rows - 1 || !set.has(pos + cols)) {
          this._gctx.beginPath();
          this._gctx.moveTo(x0, y1);
          this._gctx.lineTo(x1, y1);
          this._gctx.stroke();
        }
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
  dimGroup(group, dim) { group.forEach((p) => { const el = this._cellEls[p]; if (el) el.style.opacity = dim ? '0' : ''; }); }
}
