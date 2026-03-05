import { getAsset, putAsset } from '../storage/persistence.js';

export class AssetManager {
  constructor({ maxEntries = 5 } = {}) {
    this.maxEntries = maxEntries;
    this.cache = new Map();
  }

  _touch(key, value) {
    if (this.cache.has(key)) this.cache.delete(key);
    this.cache.set(key, value);
    if (this.cache.size > this.maxEntries) {
      const oldest = this.cache.keys().next().value;
      this.cache.delete(oldest);
    }
  }

  async preload(level) {
    const key = `level-image:${level.progressKey || level.id}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const canvas = await level.image.generate();
    this._touch(key, canvas);

    if (canvas?.toBlob) {
      canvas.toBlob((blob) => {
        if (blob) putAsset(key, blob);
      }, 'image/png');
    }
    return canvas;
  }

  async restore(levelCacheId) {
    const key = `level-image:${levelCacheId}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const blob = await getAsset(key);
    if (!blob) return null;
    const imageBitmap = await createImageBitmap(blob);
    const cv = document.createElement('canvas');
    cv.width = imageBitmap.width;
    cv.height = imageBitmap.height;
    cv.getContext('2d').drawImage(imageBitmap, 0, 0);
    this._touch(key, cv);
    return cv;
  }

  buildPieces(image, cols, rows) {
    const cellW = image.width / cols;
    const cellH = image.height / rows;
    const pieces = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const id = r * cols + c;
        const cv = document.createElement('canvas');
        cv.width = cellW;
        cv.height = cellH;
        cv.getContext('2d').drawImage(image, c * cellW, r * cellH, cellW, cellH, 0, 0, cellW, cellH);
        pieces.push({ id, canvas: cv });
      }
    }
    return { pieces, cellW, cellH };
  }
}
