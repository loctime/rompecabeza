export const EVENTS = {
  MOVE_APPLIED: 'MOVE_APPLIED',
  FUSION_GAINED: 'FUSION_GAINED',
  PUZZLE_SOLVED: 'PUZZLE_SOLVED',
  TIMER_TICK: 'TIMER_TICK',
  SESSION_END: 'SESSION_END',
};

export class EventBus {
  constructor() { this._map = new Map(); }
  on(type, fn) {
    if (!this._map.has(type)) this._map.set(type, new Set());
    this._map.get(type).add(fn);
    return () => this.off(type, fn);
  }
  off(type, fn) { this._map.get(type)?.delete(fn); }
  emit(type, payload) { this._map.get(type)?.forEach((fn) => fn(payload)); }
  clear() { this._map.clear(); }
}
