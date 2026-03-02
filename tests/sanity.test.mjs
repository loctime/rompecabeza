import test from 'node:test';
import assert from 'node:assert/strict';
import { PuzzleEngine } from '../engine/PuzzleEngine.js';

test('engine serialize/deserialize roundtrip', () => {
  let state = PuzzleEngine.createInitialState({ cols: 3, rows: 3 });
  state = PuzzleEngine.shuffleState(state, () => 0.5);
  const data = PuzzleEngine.serialize(state);
  const restored = PuzzleEngine.deserialize(data);
  assert.equal(restored.cols, 3);
  assert.equal(restored.board.length, 9);
});

test('applyMove returns structured result', () => {
  const state = PuzzleEngine.createInitialState({ cols: 2, rows: 2 });
  const res = PuzzleEngine.applyMove(state, 0, 1, 0);
  assert.equal(typeof res.moved, 'boolean');
  assert.ok(Array.isArray(res.affected));
});

test('isSolved true for initial board', () => {
  const state = PuzzleEngine.createInitialState({ cols: 2, rows: 2 });
  assert.equal(PuzzleEngine.isSolved(state), true);
});
