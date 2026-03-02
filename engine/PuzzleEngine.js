/**
 * engine/PuzzleEngine.js
 * Dominio puro del puzzle (sin DOM/canvas).
 */

export function createInitialState({ cols, rows, pieceIds }) {
  const total = cols * rows;
  const ids = pieceIds && pieceIds.length === total
    ? [...pieceIds]
    : Array.from({ length: total }, (_, i) => i);

  return {
    cols,
    rows,
    total,
    board: [...ids],
    solvedBoard: [...ids],
    moveCount: 0,
  };
}

export function shuffleState(state, rng = Math.random) {
  const board = [...state.board];
  for (let i = board.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [board[i], board[j]] = [board[j], board[i]];
  }
  return { ...state, board, moveCount: 0 };
}

export function getFusedEdges(state) {
  const s = new Set();
  for (let pos = 0; pos < state.total; pos++) {
    const col = pos % state.cols;
    const row = Math.floor(pos / state.cols);
    const cpH = state.board[pos];

    if (col < state.cols - 1) {
      const rp = pos + 1;
      const cpR = state.board[rp];
      if (cpR === cpH + 1 && Math.floor(cpH / state.cols) === Math.floor(cpR / state.cols)) {
        s.add(`${pos}:${rp}`);
      }
    }

    if (row < state.rows - 1) {
      const bp = pos + state.cols;
      const cpB = state.board[bp];
      if (cpB === cpH + state.cols) s.add(`${pos}:${bp}`);
    }
  }
  return s;
}

export function getGroup(state, startPos, fusedEdges = getFusedEdges(state)) {
  const v = new Set([startPos]);
  const q = [startPos];
  while (q.length) {
    const p = q.shift();
    const col = p % state.cols;
    const row = Math.floor(p / state.cols);
    [
      [p + 1, col < state.cols - 1],
      [p - 1, col > 0],
      [p + state.cols, row < state.rows - 1],
      [p - state.cols, row > 0],
    ].forEach(([n, ok]) => {
      if (!ok || v.has(n)) return;
      const key = p < n ? `${p}:${n}` : `${n}:${p}`;
      if (fusedEdges.has(key)) {
        v.add(n);
        q.push(n);
      }
    });
  }
  return [...v];
}

export function applyMove(state, originPos, destCol, destRow) {
  const fused = getFusedEdges(state);
  const group = getGroup(state, originPos, fused);
  const groupCols = group.map((p) => p % state.cols);
  const groupRows = group.map((p) => Math.floor(p / state.cols));
  const minC = Math.min(...groupCols);
  const minR = Math.min(...groupRows);
  const dc = destCol - minC;
  const dr = destRow - minR;

  if (dc === 0 && dr === 0) {
    return { moved: false, state, fusionGained: false, solved: isSolved(state), affected: [] };
  }

  const newPos = group.map((p) =>
    (Math.floor(p / state.cols) + dr) * state.cols + (p % state.cols + dc)
  );

  for (const np of newPos) {
    const nr = Math.floor(np / state.cols);
    const nc = np % state.cols;
    if (np < 0 || np >= state.total || nr < 0 || nr >= state.rows || nc < 0 || nc >= state.cols) {
      return { moved: false, state, fusionGained: false, solved: isSolved(state), affected: [] };
    }
  }

  const prevFused = fused.size;
  const board = [...state.board];
  const vacated = group.filter((p) => !newPos.includes(p));
  const displaced = newPos.filter((np) => !group.includes(np));
  const dispPieces = displaced.map((p) => state.board[p]);

  group.forEach((p, i) => {
    board[newPos[i]] = state.board[p];
  });
  vacated.forEach((p, i) => {
    board[p] = dispPieces[i];
  });

  const next = { ...state, board, moveCount: state.moveCount + 1 };
  const nowFused = getFusedEdges(next).size;
  return {
    moved: true,
    state: next,
    fusionGained: nowFused > prevFused,
    solved: isSolved(next),
    affected: [...new Set([...group, ...newPos, ...vacated, ...displaced])],
  };
}

export function getPossibleMoves(state) {
  const fused = getFusedEdges(state);
  const moves = [];
  for (let pos = 0; pos < state.total; pos++) {
    const group = getGroup(state, pos, fused);
    const cols = group.map((p) => p % state.cols);
    const rows = group.map((p) => Math.floor(p / state.cols));
    const spanC = Math.max(...cols) - Math.min(...cols);
    const spanR = Math.max(...rows) - Math.min(...rows);
    for (let r = 0; r <= state.rows - 1 - spanR; r++) {
      for (let c = 0; c <= state.cols - 1 - spanC; c++) {
        moves.push({ originPos: pos, destCol: c, destRow: r });
      }
    }
  }
  return moves;
}

export function isSolved(state) {
  for (let i = 0; i < state.total; i++) {
    if (state.board[i] !== state.solvedBoard[i]) return false;
  }
  return true;
}

export function serialize(state) {
  return JSON.stringify(state);
}

export function deserialize(payload) {
  const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
  if (!parsed || !Array.isArray(parsed.board)) throw new Error('Invalid puzzle state');
  return {
    cols: parsed.cols,
    rows: parsed.rows,
    total: parsed.total,
    board: [...parsed.board],
    solvedBoard: [...parsed.solvedBoard],
    moveCount: parsed.moveCount || 0,
  };
}

export const PuzzleEngine = {
  createInitialState,
  shuffleState,
  applyMove,
  getPossibleMoves,
  isSolved,
  serialize,
  deserialize,
  getFusedEdges,
  getGroup,
};
