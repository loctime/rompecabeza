const DB_NAME = 'puzzle-platform-db';
const DB_VERSION = 2;

const LEGACY_STORES = {
  progress: 'progress',
  settings: 'settings',
  history: 'history',
  assets: 'assets',
};

const STORES = {
  users: 'users',
  progress: 'progressV2',
  sessions: 'sessions',
  settings: 'settingsV2',
  assets: 'assetsV2',
  syncQueue: 'syncQueue',
};

let activeUserId = 'default';

function createV2Schema(db) {
  let users;
  if (db.objectStoreNames.contains(STORES.users)) users = null;
  else users = db.createObjectStore(STORES.users, { keyPath: 'userId' });

  let progress;
  if (db.objectStoreNames.contains(STORES.progress)) progress = null;
  else progress = db.createObjectStore(STORES.progress, { keyPath: ['userId', 'levelId', 'mode'] });

  let sessions;
  if (db.objectStoreNames.contains(STORES.sessions)) sessions = null;
  else sessions = db.createObjectStore(STORES.sessions, { keyPath: 'sessionId' });

  let settings;
  if (db.objectStoreNames.contains(STORES.settings)) settings = null;
  else settings = db.createObjectStore(STORES.settings, { keyPath: ['userId', 'key'] });

  let assets;
  if (db.objectStoreNames.contains(STORES.assets)) assets = null;
  else assets = db.createObjectStore(STORES.assets, { keyPath: 'hash' });

  let syncQueue;
  if (db.objectStoreNames.contains(STORES.syncQueue)) syncQueue = null;
  else syncQueue = db.createObjectStore(STORES.syncQueue, { keyPath: 'opId' });

  const ensureIdx = (storeName, idx, path, opts = { unique: false }) => {
    const store = db.transaction ? null : null;
    const target = (
      storeName === STORES.users ? users :
      storeName === STORES.progress ? progress :
      storeName === STORES.sessions ? sessions :
      storeName === STORES.settings ? settings :
      storeName === STORES.assets ? assets :
      syncQueue
    );
    if (target && !target.indexNames.contains(idx)) target.createIndex(idx, path, opts);
  };

  ensureIdx(STORES.users, 'createdAt', 'createdAt');
  ensureIdx(STORES.progress, 'byUser', 'userId');
  ensureIdx(STORES.progress, 'updatedAt', 'updatedAt');
  ensureIdx(STORES.progress, 'dirty', 'dirty');
  ensureIdx(STORES.sessions, 'byUser', 'userId');
  ensureIdx(STORES.sessions, 'byUserLevel', ['userId', 'levelId']);
  ensureIdx(STORES.sessions, 'endedAt', 'endedAt');
  ensureIdx(STORES.settings, 'byUser', 'userId');
  ensureIdx(STORES.assets, 'lastAccessAt', 'lastAccessAt');
  ensureIdx(STORES.syncQueue, 'byUser', 'userId');
  ensureIdx(STORES.syncQueue, 'type', 'type');
}

function cursorToArray(store) {
  return new Promise((resolve, reject) => {
    const rows = [];
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return resolve(rows);
      rows.push({ key: cursor.key, value: cursor.value });
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

async function getAllFromStore(db, storeName) {
  if (!db.objectStoreNames.contains(storeName)) return [];
  return new Promise((resolve, reject) => {
    const rows = [];
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return resolve(rows);
      rows.push({ key: c.key, value: c.value });
      c.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

async function migrateLegacyAfterOpen(db) {
  const already = await new Promise((resolve) => {
    const tx = db.transaction(STORES.settings, 'readonly');
    const req = tx.objectStore(STORES.settings).get(['system', 'migration:v1ToV2']);
    req.onsuccess = () => resolve(Boolean(req.result));
    req.onerror = () => resolve(false);
  });
  if (already) return;

  const now = Date.now();
  const [legacySettings, legacyProgress, legacyHistory, legacyAssets] = await Promise.all([
    getAllFromStore(db, LEGACY_STORES.settings),
    getAllFromStore(db, LEGACY_STORES.progress),
    getAllFromStore(db, LEGACY_STORES.history),
    getAllFromStore(db, LEGACY_STORES.assets),
  ]);

  await new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.users, STORES.progress, STORES.settings, STORES.sessions, STORES.assets], 'readwrite');
    const usersStore = tx.objectStore(STORES.users);
    const progressStore = tx.objectStore(STORES.progress);
    const settingsStore = tx.objectStore(STORES.settings);
    const sessionsStore = tx.objectStore(STORES.sessions);
    const assetsStore = tx.objectStore(STORES.assets);

    usersStore.put({ userId: 'default', displayName: 'Jugador local', createdAt: now, updatedAt: now });

    legacySettings.forEach((row) => {
      if (!row || typeof row !== 'object' || !('key' in row)) return;
      settingsStore.put({ userId: 'default', key: String(row.key), value: row.value, updatedAt: now });
    });

    legacyProgress.forEach((row) => {
      const key = row?.key;
      const value = row?.value;
      if (key === 'all-levels' && value && typeof value === 'object') {
        Object.entries(value).forEach(([levelId, summary]) => {
          progressStore.put({ userId: 'default', levelId, mode: summary?.lastMode || 'classic', stars: summary?.solved ? 1 : 0, bestTimeMs: null, bestMoves: null, bestScore: summary?.bestScore ?? 0, updatedAt: now, dirty: false, source: 'legacy-all-levels' });
        });
      } else if (typeof key === 'string' && key.includes(':') && value?.snapshot) {
        const [levelId, mode] = key.split(':');
        const snapshot = value.snapshot || {};
        progressStore.put({ userId: 'default', levelId, mode: mode || 'classic', stars: snapshot.fusedEdges === snapshot.totalEdges ? 1 : 0, bestTimeMs: snapshot.elapsedMs ?? null, bestMoves: snapshot.moveCount ?? null, bestScore: snapshot.score ?? 0, updatedAt: now, dirty: false, source: 'legacy-session-progress' });
      }
    });

    legacyHistory.forEach((row) => {
      const levelId = String(row?.key || 'unknown');
      const entries = Array.isArray(row?.value) ? row.value : [];
      entries.forEach((entry, idx) => {
        const endedAt = Number(entry?.endedAt || now);
        sessionsStore.put({ sessionId: `legacy-${levelId}-${endedAt}-${idx}`, userId: 'default', levelId, mode: entry?.mode || 'classic', startedAt: Math.max(endedAt - Number(entry?.elapsedMs || 0), 0), endedAt, stats: { elapsedMs: entry?.elapsedMs ?? 0, score: entry?.score ?? 0, moveCount: entry?.moveCount ?? 0, fusedEdges: entry?.fusedEdges ?? 0, totalEdges: entry?.totalEdges ?? 0 }, seed: entry?.seed || null, source: 'legacy-history' });
      });
    });

    legacyAssets.forEach((row) => {
      const key = row?.key; const value = row?.value;
      assetsStore.put({ hash: `legacy:${String(key)}`, blob: value, meta: { legacyKey: String(key) }, lastAccessAt: now, size: value?.size || 0 });
    });

    settingsStore.put({ userId: 'system', key: 'migration:v1ToV2', value: { at: now }, updatedAt: now });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function openDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      resolve(null);
      return;
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      createV2Schema(req.result);
    };
    req.onsuccess = async () => {
      const db = req.result;
      try {
        await migrateLegacyAfterOpen(db);
      } catch {}
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
}

async function withStore(store, mode, fn) {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const os = tx.objectStore(store);
    const req = fn(os, tx);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function lsKey(userId, key) {
  return `u:${userId}:${key}`;
}

export function setActiveUser(userId = 'default') {
  activeUserId = userId || 'default';
}

export function getActiveUser() {
  return activeUserId;
}

export class UserRepository {
  async listUsers() {
    return (await withStore(STORES.users, 'readonly', (os) => os.getAll())) || [];
  }

  async upsertUser(user) {
    const now = Date.now();
    await withStore(STORES.users, 'readwrite', (os) => os.put({ createdAt: now, ...user, updatedAt: now }));
  }

  async getUser(userId) {
    return withStore(STORES.users, 'readonly', (os) => os.get(userId));
  }
}

export class SettingsRepository {
  constructor(userId) {
    this.userId = userId;
  }

  async set(key, value) {
    localStorage.setItem(lsKey(this.userId, `setting:${key}`), JSON.stringify(value));
    try {
      await withStore(STORES.settings, 'readwrite', (os) => os.put({ userId: this.userId, key, value, updatedAt: Date.now() }));
    } catch {}
  }

  async get(key, fallback = null) {
    const raw = localStorage.getItem(lsKey(this.userId, `setting:${key}`));
    if (raw) return JSON.parse(raw);
    try {
      const row = await withStore(STORES.settings, 'readonly', (os) => os.get([this.userId, key]));
      return row?.value ?? fallback;
    } catch {
      return fallback;
    }
  }
}

export class ProgressRepository {
  constructor(userId) {
    this.userId = userId;
  }

  async upsertLevelMode(levelId, mode, patch) {
    const prev = await withStore(STORES.progress, 'readonly', (os) => os.get([this.userId, levelId, mode])) || {};
    const next = {
      userId: this.userId,
      levelId,
      mode,
      stars: 0,
      bestTimeMs: null,
      bestMoves: null,
      bestScore: 0,
      dirty: true,
      ...prev,
      ...patch,
      updatedAt: Date.now(),
    };
    await withStore(STORES.progress, 'readwrite', (os) => os.put(next));
    return next;
  }

  async getLevelMode(levelId, mode) {
    return withStore(STORES.progress, 'readonly', (os) => os.get([this.userId, levelId, mode]));
  }

  async getAllForUser() {
    const db = await openDB();
    if (!db) return [];
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.progress, 'readonly');
      const idx = tx.objectStore(STORES.progress).index('byUser');
      const req = idx.getAll(this.userId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getSummaryByLevel() {
    const rows = await this.getAllForUser();
    const summary = {};
    rows.forEach((row) => {
      const prev = summary[row.levelId] || { bestScore: 0, solved: false, lastMode: 'classic' };
      summary[row.levelId] = {
        bestScore: Math.max(prev.bestScore || 0, row.bestScore || 0),
        solved: prev.solved || (row.stars || 0) > 0,
        lastMode: row.mode || prev.lastMode,
      };
    });
    return summary;
  }
}

export class SessionRepository {
  constructor(userId) {
    this.userId = userId;
  }

  async append(session) {
    const now = Date.now();
    const row = {
      sessionId: session.sessionId || `${this.userId}-${session.levelId}-${session.mode}-${now}`,
      userId: this.userId,
      levelId: session.levelId,
      mode: session.mode,
      startedAt: session.startedAt,
      endedAt: session.endedAt || now,
      stats: session.stats || {},
      seed: session.seed || null,
    };
    await withStore(STORES.sessions, 'readwrite', (os) => os.put(row));
    return row;
  }
}

export class AssetRepository {
  async put(hash, blob, meta = {}) {
    await withStore(STORES.assets, 'readwrite', (os) => os.put({ hash, blob, meta, lastAccessAt: Date.now(), size: blob?.size || 0 }));
  }

  async get(hash) {
    const row = await withStore(STORES.assets, 'readonly', (os) => os.get(hash));
    if (!row) return null;
    await withStore(STORES.assets, 'readwrite', (os) => os.put({ ...row, lastAccessAt: Date.now() }));
    return row.blob;
  }
}

export class SyncQueueRepository {
  async enqueue(op) {
    const row = {
      opId: op.opId || `${op.userId || activeUserId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      attempts: 0,
      createdAt: Date.now(),
      ...op,
    };
    await withStore(STORES.syncQueue, 'readwrite', (os) => os.put(row));
    return row;
  }
}

// Compatibility layer (legacy calls kept for incremental migration)
export async function setProgress(key, value) {
  const repo = new ProgressRepository(activeUserId);
  if (key === 'all-levels' && value && typeof value === 'object') {
    const puts = Object.entries(value).map(([levelId, summary]) => repo.upsertLevelMode(levelId, summary?.lastMode || 'classic', {
      bestScore: summary?.bestScore || 0,
      stars: summary?.solved ? 1 : 0,
      dirty: true,
    }));
    await Promise.all(puts);
    return;
  }

  if (typeof key === 'string' && key.includes(':')) {
    const [levelId, mode] = key.split(':');
    const snapshot = value?.snapshot || {};
    await repo.upsertLevelMode(levelId, mode || 'classic', {
      bestScore: snapshot.score || 0,
      bestTimeMs: snapshot.elapsedMs ?? null,
      bestMoves: snapshot.moveCount ?? null,
      stars: snapshot.fusedEdges === snapshot.totalEdges ? 1 : 0,
      dirty: true,
      snapshot,
      serialized: value?.serialized,
    });
  }
}

export async function getProgress(key) {
  const repo = new ProgressRepository(activeUserId);
  if (key === 'all-levels') {
    return repo.getSummaryByLevel();
  }
  if (typeof key === 'string' && key.includes(':')) {
    const [levelId, mode] = key.split(':');
    const row = await repo.getLevelMode(levelId, mode || 'classic');
    if (!row) return null;
    return { snapshot: row.snapshot || null, serialized: row.serialized || null };
  }
  return null;
}

export async function setSetting(key, value) {
  const repo = new SettingsRepository(activeUserId);
  await repo.set(key, value);
}

export async function getSetting(key, fallback = null) {
  const repo = new SettingsRepository(activeUserId);
  return repo.get(key, fallback);
}

export async function addHistory(key, value) {
  const repo = new SessionRepository(activeUserId);
  await repo.append({
    levelId: key,
    mode: value?.mode || 'classic',
    startedAt: Math.max((value?.endedAt || Date.now()) - Number(value?.elapsedMs || 0), 0),
    endedAt: value?.endedAt || Date.now(),
    stats: value,
    seed: value?.seed || null,
  });
}

export async function putAsset(key, blob) {
  const repo = new AssetRepository();
  await repo.put(`legacy:${key}`, blob, { legacyKey: key });
}

export async function getAsset(key) {
  const repo = new AssetRepository();
  return repo.get(`legacy:${key}`);
}

export async function enqueueSyncOperation(op) {
  const repo = new SyncQueueRepository();
  return repo.enqueue(op);
}

export { DB_NAME, DB_VERSION, STORES };
