import { ImageCache } from './ImageCache.js';
import { DailyChallenge } from './DailyChallenge.js';

const BOARD_W = 360;
const BOARD_H = 640;

const GRID_TO_BOARD = {
  3: { cols: 3, rows: 4 },
  4: { cols: 4, rows: 4 },
  5: { cols: 4, rows: 5 },
  6: { cols: 5, rows: 5 },
  7: { cols: 5, rows: 6 },
};

function loadImageCanvas(url, width, height) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = width;
      cv.height = height;
      const ctx = cv.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(cv);
    };
    img.onerror = () => reject(new Error(`No se pudo cargar la imagen ${url}`));
    img.src = url;
  });
}

export function decorateLevelToEngineFormat(base) {
  if (!base) return null;
  const grid = base.grid ?? 4;
  const pattern = GRID_TO_BOARD[grid] || GRID_TO_BOARD[4];
  const board = {
    cols: pattern.cols,
    rows: pattern.rows,
    boardW: BOARD_W,
    boardH: BOARD_H,
  };
  const imageUrl = base.image;
  return {
    ...base,
    board,
    _imageUrl: imageUrl,
    meta: {
      title: base.title || base.id,
      difficulty: base.difficulty ?? 1,
    },
    image: {
      generate: () => loadImageCanvas(imageUrl, board.boardW, board.boardH),
    },
  };
}

export class LevelManager {
  constructor({
    localProvider,
    remoteProvider = null,
    queueMin = 4,
    queueTarget = 10,
    infinitePackId = 'infinito',
  } = {}) {
    this.localProvider = localProvider;
    this.remoteProvider = remoteProvider;
    this.queueMin = queueMin;
    this.queueTarget = queueTarget;
    this.infinitePackId = infinitePackId;
    this.queue = [];
    this._infiniteIndex = 0;
  }

  async init() {
    await this.localProvider.init();

    const packs = this.localProvider.listPacks();
    const coverUrls = packs.map((p) => p.coverImage).filter(Boolean);
    if (coverUrls.length) {
      await ImageCache.warm(coverUrls, { concurrency: 2 }).catch(() => {});
    }

    await this.refillQueue();
  }

  listPacks() {
    return this.localProvider.listPacks();
  }

  listPlayablePacks() {
    return this.listPacks().filter((p) => p.id !== this.infinitePackId);
  }

  getPackLevelCount(packId) {
    const pack = this.localProvider.getPack(packId);
    return pack?.levels?.length ?? 0;
  }

  getLevelFromPack(packId, index) {
    const base = this.localProvider.getLevel(packId, index);
    return base ? decorateLevelToEngineFormat({
      ...base,
      packId,
      progressKey: `${packId}:${base.id}`,
    }) : null;
  }

  getNextLevelInPack(packId, currentLevelId) {
    const pack = this.localProvider.getPack(packId);
    const levels = pack?.levels || [];
    if (!levels.length) return null;
    const idx = levels.findIndex((l) => l.id === currentLevelId);
    if (idx < 0 || idx + 1 >= levels.length) return null;
    const base = levels[idx + 1];
    return decorateLevelToEngineFormat({
      ...base,
      packId,
      progressKey: `${packId}:${base.id}`,
    });
  }

  getDailyLevel(packId = 'variado') {
    const pack = this.localProvider.getPack(packId);
    if (!pack?.levels?.length) return null;
    const dayKey = DailyChallenge.todayKey();
    const idx = DailyChallenge.pickIndex(dayKey + '|' + packId, pack.levels.length);
    const base = pack.levels[idx];
    return base ? decorateLevelToEngineFormat({
      ...base,
      packId,
      progressKey: `${packId}:${base.id}`,
    }) : null;
  }

  async nextInfiniteLevel(packIdFallback = 'variado') {
    if (this.queue.length <= this.queueMin) {
      this.refillQueue().catch(() => {});
    }

    const base = this.queue.shift();
    if (!base) {
      return this.getDailyLevel(packIdFallback);
    }

    const next = this.queue[0];
    if (next?.image) {
      ImageCache.preloadImage(next.image).catch(() => {});
    }

    return decorateLevelToEngineFormat(base);
  }

  resetInfiniteProgress() {
    this.queue = [];
    this._infiniteIndex = 0;
  }

  async refillQueue() {
    const packId = this.infinitePackId;
    const pack = this.localProvider.getPack(packId);
    const count = pack?.levels?.length ?? 0;

    while (this.queue.length < this.queueTarget) {
      if (count > 0) {
        const base = this.localProvider.getLevel(packId, this._infiniteIndex);
        this._infiniteIndex += 1;
        if (base) {
          this.queue.push({
            ...base,
            packId,
            progressKey: `${packId}:${base.id}`,
          });
          const url = base.image;
          if (url) ImageCache.warm([url], { concurrency: 1 }).catch(() => {});
        }
      }

      if (this.remoteProvider) {
        try {
          const batch = await this.remoteProvider.fetchBatch({ perPage: 6, page: 1 });
          const pick = (batch || []).slice(0, 2);
          this.queue.push(...pick);
          const urls = pick.map((l) => l.image).filter(Boolean);
          if (urls.length) await ImageCache.warm(urls, { concurrency: 3 });
        } catch {
          // ignore
        }
        break;
      }

      if (count === 0) break;
    }
  }
}
