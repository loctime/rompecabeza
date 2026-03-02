/**
 * Service Worker — Puzzle Platform PWA
 * Cache segmentada: cache-first estáticos, network-first navegación.
 * Sin skipWaiting/clients.claim; notificación al usuario para activar nueva versión.
 */

const CACHE_VERSION = 2;
const CACHE_STATIC = `puzzle-cache-v${CACHE_VERSION}`;
const CACHE_NAV = `puzzle-nav-v${CACHE_VERSION}`;

const STATIC_PATHS = [
  '',
  'index.html',
  'main.js',
  'engine/PuzzleEngine.js',
  'engine/DragController.js',
  'levels/mountainNight.js',
  'audio/AudioManager.js',
  'ui/BoardUI.js',
  'ui/HUD.js',
  'ui/styles.css',
  'manifest.json',
  'icons/icon-192.svg',
  'icons/icon-512.svg',
  'offline.html'
];

function getBase() {
  const path = self.location.pathname.replace(/\/[^/]*$/, '/');
  return self.location.origin + (path.endsWith('/') ? path : path + '/');
}

function isStaticAsset(request) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  const path = url.pathname;
  return /\.(js|css|json|png|svg|woff2?|ico)$/i.test(path) ||
    path.endsWith('/manifest.json') ||
    path.includes('/engine/') ||
    path.includes('/ui/') ||
    path.includes('/audio/') ||
    path.includes('/levels/') ||
    path.includes('/icons/') ||
    path.includes('/fonts/');
}

// install: precache solo estáticos (no HTML de navegación sin validación)
self.addEventListener('install', (event) => {
  const base = getBase();
  const urls = STATIC_PATHS.map((p) => (p === '' ? base : base + p));
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => cache.addAll(urls))
      .catch((err) => console.warn('SW precache failed:', err))
  );
  // No skipWaiting: el cliente decidirá cuándo activar
});

// activate: limpiar caches antiguos; no claim automático
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n.startsWith('puzzle-') && n !== CACHE_STATIC && n !== CACHE_NAV)
          .map((n) => caches.delete(n))
      )
    ).then(() => {
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SW_ACTIVATED', version: CACHE_VERSION });
        });
      });
    })
  );
});

// fetch: estáticos cache-first; navegación network-first; solo cachear respuestas OK
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const isNav = event.request.mode === 'navigate';
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (isNav) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.status === 200 && res.type === 'basic') {
            const clone = res.clone();
            caches.open(CACHE_NAV).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            const base = getBase();
            return caches.match(base + 'offline.html').then((offline) => offline || caches.match(base + 'index.html'));
          });
        })
    );
    return;
  }

  if (isStaticAsset(event.request)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((res) => {
          if (res.status !== 200 || res.type !== 'basic') return res;
          const clone = res.clone();
          caches.open(CACHE_STATIC).then((cache) => cache.put(event.request, clone));
          return res;
        }).catch(() => new Response('', { status: 503, statusText: 'Offline' }));
      })
    );
  }
});

// El cliente puede enviar SKIP_WAITING para activar esta versión (sin auto-claim)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
