/**
 * Service Worker — Puzzle Platform PWA
 * Cache versionado, estrategia cache-first, limpieza en activate.
 */

const CACHE_NAME = 'puzzle-cache-v1';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/main.js',
  '/engine/PuzzleEngine.js',
  '/engine/DragController.js',
  '/levels/mountainNight.js',
  '/audio/AudioManager.js',
  '/ui/BoardUI.js',
  '/ui/HUD.js',
  '/ui/styles.css',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
];

// install: precache de todos los recursos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('SW install precache failed:', err))
  );
});

// activate: limpiar caches antiguos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// fetch: cache-first, fallback a red
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const clone = response.clone();
        if (response.status === 200 && event.request.url.startsWith(self.location.origin)) {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Network failed (offline): no romper la app
        return new Response('', { status: 503, statusText: 'Offline' });
      });
    })
  );
});
