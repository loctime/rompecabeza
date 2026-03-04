// Same name as service worker image cache for coordination
export const CACHE_NAME = 'puzzle-images-v1';

export class ImageCache {
  static async warm(urls, { concurrency = 4 } = {}) {
    const queue = [...urls].filter(Boolean);
    const workers = Array.from({ length: concurrency }, () => worker(queue));
    await Promise.all(workers);
  }

  static async has(url) {
    const cache = await caches.open(CACHE_NAME);
    const req = new Request(url, { cache: 'reload' });
    const hit = await cache.match(req);
    return !!hit;
  }

  static async put(url, response) {
    const cache = await caches.open(CACHE_NAME);
    const req = new Request(url, { cache: 'reload' });
    await cache.put(req, response);
  }

  static preloadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => reject(new Error('Image preload failed'));
      img.src = url;
    });
  }
}

async function worker(queue) {
  while (queue.length) {
    const url = queue.shift();
    if (!url) continue;
    try {
      await ImageCache.preloadImage(url);
      const req = new Request(url, { mode: 'cors' });
      const res = await fetch(req);
      if (res.ok) await ImageCache.put(url, res.clone());
    } catch {
      // ignore failed URLs
    }
  }
}
