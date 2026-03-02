const DB_NAME = 'puzzle-platform-db';
const DB_VERSION = 1;
const STORE_PROGRESS = 'progress';
const STORE_SETTINGS = 'settings';
const STORE_HISTORY = 'history';
const STORE_ASSETS = 'assets';

function openDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      resolve(null);
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      [STORE_PROGRESS, STORE_SETTINGS, STORE_HISTORY, STORE_ASSETS].forEach((name) => {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(store, mode, fn) {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const os = tx.objectStore(store);
    const req = fn(os);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function setProgress(key, value) {
  try { await withStore(STORE_PROGRESS, 'readwrite', (os) => os.put(value, key)); }
  catch { localStorage.setItem(`progress:${key}`, JSON.stringify(value)); }
}
export async function getProgress(key) {
  try {
    const v = await withStore(STORE_PROGRESS, 'readonly', (os) => os.get(key));
    if (v !== undefined) return v;
  } catch {}
  const raw = localStorage.getItem(`progress:${key}`);
  return raw ? JSON.parse(raw) : null;
}

export async function setSetting(key, value) {
  localStorage.setItem(`setting:${key}`, JSON.stringify(value));
  try { await withStore(STORE_SETTINGS, 'readwrite', (os) => os.put(value, key)); } catch {}
}

export async function getSetting(key, fallback = null) {
  const raw = localStorage.getItem(`setting:${key}`);
  if (raw) return JSON.parse(raw);
  try {
    const v = await withStore(STORE_SETTINGS, 'readonly', (os) => os.get(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

export async function addHistory(key, value) {
  try {
    const prev = (await withStore(STORE_HISTORY, 'readonly', (os) => os.get(key))) || [];
    await withStore(STORE_HISTORY, 'readwrite', (os) => os.put([...prev, value], key));
  } catch {
    const raw = localStorage.getItem(`history:${key}`);
    const prev = raw ? JSON.parse(raw) : [];
    localStorage.setItem(`history:${key}`, JSON.stringify([...prev, value]));
  }
}

export async function putAsset(key, blob) {
  try { await withStore(STORE_ASSETS, 'readwrite', (os) => os.put(blob, key)); } catch {}
}
export async function getAsset(key) {
  try { return await withStore(STORE_ASSETS, 'readonly', (os) => os.get(key)); } catch { return null; }
}
