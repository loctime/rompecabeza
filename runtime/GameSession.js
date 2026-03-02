import { PuzzleEngine } from '../engine/PuzzleEngine.js';
import { EVENTS } from './events.js';
import { addHistory, getProgress, setProgress } from '../storage/persistence.js';

const MODE_DEFAULTS = {
  classic: { timeLimitMs: null },
  timed: { timeLimitMs: 180000 },
  zen: { timeLimitMs: null },
};

export class GameSession {
  constructor({ level, mode = 'classic', bus }) {
    this.level = level;
    this.mode = mode;
    this.bus = bus;
    this.state = PuzzleEngine.createInitialState({ cols: level.board.cols, rows: level.board.rows });
    this.state = PuzzleEngine.shuffleState(this.state);
    this.startedAt = performance.now();
    this.elapsedMs = 0;
    this.score = 0;
    this._raf = null;
    this._ended = false;
    this.config = { ...MODE_DEFAULTS[mode] };
  }

  start() {
    const tick = () => {
      if (this._ended) return;
      this.elapsedMs = performance.now() - this.startedAt;
      this.bus.emit(EVENTS.TIMER_TICK, this.getSnapshot());

      if (this.config.timeLimitMs && this.elapsedMs >= this.config.timeLimitMs) {
        this.end('timeout');
        return;
      }
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  }

  applyMove(originPos, destCol, destRow) {
    const result = PuzzleEngine.applyMove(this.state, originPos, destCol, destRow);
    if (!result.moved) return result;
    this.state = result.state;
    this.score += result.fusionGained ? 25 : 5;
    this.bus.emit(EVENTS.MOVE_APPLIED, { ...this.getSnapshot(), affected: result.affected });
    if (result.fusionGained) this.bus.emit(EVENTS.FUSION_GAINED, this.getSnapshot());
    if (result.solved) {
      this.bus.emit(EVENTS.PUZZLE_SOLVED, this.getSnapshot());
      this.end('win');
    }
    return result;
  }

  shuffle() {
    this.state = PuzzleEngine.shuffleState(this.state);
    this.bus.emit(EVENTS.MOVE_APPLIED, { ...this.getSnapshot(), affected: Array.from({ length: this.state.total }, (_, i) => i) });
  }

  isSolved() {
    return PuzzleEngine.isSolved(this.state);
  }

  getFusedEdges() {
    return PuzzleEngine.getFusedEdges(this.state);
  }

  getGroup(pos, fused) {
    return PuzzleEngine.getGroup(this.state, pos, fused);
  }

  getSnapshot() {
    return {
      levelId: this.level.id,
      mode: this.mode,
      elapsedMs: this.elapsedMs,
      score: this.score,
      board: this.state.board,
      totalEdges: this.state.cols * (this.state.rows - 1) + this.state.rows * (this.state.cols - 1),
      fusedEdges: this.getFusedEdges().size,
      moveCount: this.state.moveCount,
      cols: this.state.cols,
      rows: this.state.rows,
    };
  }

  async saveProgress() {
    const key = `${this.level.id}:${this.mode}`;
    await setProgress(key, { snapshot: this.getSnapshot(), serialized: PuzzleEngine.serialize(this.state) });
    await addHistory(this.level.id, { endedAt: Date.now(), ...this.getSnapshot() });
  }

  async restoreProgress() {
    const key = `${this.level.id}:${this.mode}`;
    const data = await getProgress(key);
    if (!data?.serialized) return false;
    this.state = PuzzleEngine.deserialize(data.serialized);
    this.score = data.snapshot?.score || 0;
    return true;
  }

  async end(reason = 'ended') {
    if (this._ended) return;
    this._ended = true;
    this.stop();
    await this.saveProgress();
    this.bus.emit(EVENTS.SESSION_END, { reason, ...this.getSnapshot() });
  }
}
