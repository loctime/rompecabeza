const CACHE_VERSION = 'v3';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DATA_CACHE = `data-${CACHE_VERSION}`;
const NAV_CACHE = `nav-${CACHE_VERSION}`;
const IMAGE_CACHE = 'puzzle-images-v1';

const STATIC_ALLOWLIST = [
  './', './index.html', './offline.html', './main.js',
  './ui/styles.css', './ui/BoardUI.js', './ui/HUD.js',
  './engine/PuzzleEngine.js', './engine/DragController.js',
  './runtime/GameSession.js', './runtime/AssetManager.js', './runtime/store.js', './runtime/events.js',
  './storage/persistence.js', './data/levels.js',
  './audio/AudioEngine.js', './audio/SfxBank.js', './audio/MusicController.js',
  './levels/mountainNight.js', './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    for (const path of STATIC_ALLOWLIST) {
      try {
        const req = new Request(path, { cache: 'reload' });
        const res = await fetch(req);
        if (res.ok) await cache.put(req, res.clone());
      } catch (_) {}
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => ![STATIC_CACHE, DATA_CACHE, NAV_CACHE, IMAGE_CACHE].includes(k)).map((k) => caches.delete(k)));
  })());
});

function isNavigation(req) { return req.mode === 'navigate'; }
function isDataRequest(url) { return url.pathname.endsWith('/data/levels.js') || url.pathname.includes('/levels/'); }
function isStatic(url) { return url.origin === self.location.origin; }
function isImageRequest(req, url) {
  return req.destination === 'image' || /\/assets\/levels\/.*\.(jpg|jpeg|png|webp)$/i.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!isStatic(url)) return;

  if (isNavigation(req)) {
    event.respondWith((async () => {
      try {
        const net = await fetch(req);
        const cache = await caches.open(NAV_CACHE);
        cache.put(req, net.clone());
        return net;
      } catch {
        return (await caches.match(req)) || (await caches.match('./offline.html')) || (await caches.match('./index.html'));
      }
    })());
    return;
  }

  if (isDataRequest(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(DATA_CACHE);
      const cached = await cache.match(req);
      try {
        const net = await fetch(req);
        if (net.ok) cache.put(req, net.clone());
        return net;
      } catch {
        return cached || new Response('{}', { headers: { 'Content-Type': 'application/json' } });
      }
    })());
    return;
  }

  if (isImageRequest(req, url)) {
    event.respondWith((async () => {
      const cache = await caches.open(IMAGE_CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const net = await fetch(req);
        if (net.ok) cache.put(req, net.clone());
        return net;
      } catch {
        return new Response('', { status: 503 });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const net = await fetch(req);
      if (net.ok) {
        const cache = await caches.open(STATIC_CACHE);
        cache.put(req, net.clone());
      }
      return net;
    } catch {
      return new Response('', { status: 503 });
    }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
