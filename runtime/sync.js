import { enqueueSyncOperation } from '../storage/persistence.js';

export class SyncOrchestrator {
  async enqueueProgressUpsert(userId, payload) {
    return enqueueSyncOperation({ userId, type: 'progress.upsert', payload });
  }

  async flush() {
    // Stub: en futuras fases enviará operaciones a backend cloud save.
    return { sent: 0, pending: 'unknown' };
  }
}
