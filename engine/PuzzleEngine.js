/**
 * engine/PuzzleEngine.js
 *
 * Pure game-logic module. Zero DOM dependencies.
 * Manages board state, fusion detection, group detection, and move execution.
 *
 * Events emitted (via .on()):
 *   'move'  — after any board change
 *   'fuse'  — when at least one new fused edge appears after a move
 *   'win'   — when the puzzle is solved
 */

export class PuzzleEngine {
  /**
   * @param {object} config
   * @param {number} config.cols
   * @param {number} config.rows
   * @param {HTMLCanvasElement} config.image  — full source image canvas
   */
  constructor({ cols, rows, image }) {
    this.cols  = cols;
    this.rows  = rows;
    this.total = cols * rows;
    this.cellW = image.width  / cols;
    this.cellH = image.height / rows;

    this._listeners = {};
    this._sliceImage(image);
    this._resetBoard();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Shuffle the board (Fisher-Yates). */
  shuffle() {
    for (let i = this.board.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.board[i], this.board[j]] = [this.board[j], this.board[i]];
    }
  }

  /**
   * Move a group starting at `originPos` so that its top-left lands at (destCol, destRow).
   * Displaced pieces swap into the vacated cells.
   * @returns {boolean} true if the move was applied
   */
  /**
   * Move the group containing `originPos` so its top-left corner lands at (destCol, destRow).
   * destCol/destRow refer to the group's bounding-box top-left, not the originPos cell.
   */
  applyMove(originPos, destCol, destRow) {
    const group     = this.getGroup(originPos);
    const groupCols = group.map(p => p % this.cols);
    const groupRows = group.map(p => Math.floor(p / this.cols));
    const minC = Math.min(...groupCols);
    const minR = Math.min(...groupRows);

    // dc/dr = shift to apply to every cell in the group
    const dc = destCol - minC;
    const dr = destRow - minR;
    if (dc === 0 && dr === 0) return false;

    const newPos = group.map(p =>
      (Math.floor(p / this.cols) + dr) * this.cols + (p % this.cols + dc)
    );

    // Bounds check
    for (const np of newPos) {
      const nr = Math.floor(np / this.cols), nc = np % this.cols;
      if (np < 0 || np >= this.total || nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols)
        return false;
    }

    const prevFused = this.getFusedEdges().size;

    const newBoard  = [...this.board];
    const vacated   = group.filter(p => !newPos.includes(p));
    const displaced = newPos.filter(np => !group.includes(np));
    const dispPieces = displaced.map(p => this.board[p]);

    group.forEach((p, i) => { newBoard[newPos[i]] = this.board[p]; });
    vacated.forEach((p, i) => { newBoard[p] = dispPieces[i]; });
    this.board = newBoard;

    const nowFused = this.getFusedEdges().size;

    this._emit('move');
    if (nowFused > prevFused) this._emit('fuse');
    if (this.isWon()) this._emit('win');

    return true;
  }

  /**
   * Returns the Set of fused edge keys "posA:posB" (posA < posB).
   * Two adjacent board cells are fused when the pieces they hold
   * are neighbors in the original image and placed in the correct relative order.
   */
  getFusedEdges() {
    const s = new Set();
    for (let pos = 0; pos < this.total; pos++) {
      const col = pos % this.cols, row = Math.floor(pos / this.cols);
      const cpH = this.pieces[this.board[pos]].correctPos;

      // Right neighbor
      if (col < this.cols - 1) {
        const rp  = pos + 1;
        const cpR = this.pieces[this.board[rp]].correctPos;
        if (cpR === cpH + 1 && Math.floor(cpH / this.cols) === Math.floor(cpR / this.cols))
          s.add(`${pos}:${rp}`);
      }
      // Bottom neighbor
      if (row < this.rows - 1) {
        const bp  = pos + this.cols;
        const cpB = this.pieces[this.board[bp]].correctPos;
        if (cpB === cpH + this.cols)
          s.add(`${pos}:${bp}`);
      }
    }
    return s;
  }

  /** Total number of internal edges (max possible fused edges). */
  get totalEdges() {
    return this.cols * (this.rows - 1) + this.rows * (this.cols - 1);
  }

  /** BFS group from startPos following fused edges. */
  getGroup(startPos, fusedEdges) {
    if (!fusedEdges) fusedEdges = this.getFusedEdges();
    const v = new Set([startPos]), q = [startPos];
    while (q.length) {
      const p = q.shift();
      const col = p % this.cols, row = Math.floor(p / this.cols);
      [
        [p + 1, col < this.cols - 1],
        [p - 1, col > 0],
        [p + this.cols, row < this.rows - 1],
        [p - this.cols, row > 0],
      ].forEach(([n, ok]) => {
        if (!ok || v.has(n)) return;
        const key = p < n ? `${p}:${n}` : `${n}:${p}`;
        if (fusedEdges.has(key)) { v.add(n); q.push(n); }
      });
    }
    return [...v];
  }

  /** True when all edges are fused (puzzle complete). */
  isWon() {
    return this.getFusedEdges().size === this.totalEdges;
  }

  // ── Events ──────────────────────────────────────────────────────────────────

  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
  }

  off(event, fn) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(f => f !== fn);
  }

  _emit(event) {
    (this._listeners[event] || []).forEach(fn => fn());
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _sliceImage(img) {
    this.pieces = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const pos = r * this.cols + c;
        const cv  = document.createElement('canvas');
        cv.width  = this.cellW;
        cv.height = this.cellH;
        cv.getContext('2d').drawImage(img, c * this.cellW, r * this.cellH, this.cellW, this.cellH, 0, 0, this.cellW, this.cellH);
        this.pieces.push({ correctPos: pos, canvas: cv });
      }
    }
  }

  _resetBoard() {
    this.board = Array.from({ length: this.total }, (_, i) => i);
  }
}
