export class LocalPackProvider {
  constructor({ catalogUrl = '/levels/catalog.json' } = {}) {
    this.catalogUrl = catalogUrl;
    this.packs = new Map();
  }

  async init() {
    const base = typeof location !== 'undefined' ? location.origin : '';
    const catalogRes = await fetch(this.catalogUrl, { cache: 'no-cache' });
    if (!catalogRes.ok) throw new Error(`Failed to load catalog: ${this.catalogUrl}`);
    const catalog = await catalogRes.json();

    for (const p of catalog.packs || []) {
      const manifestUrl = p.manifest.startsWith('http') ? p.manifest : new URL(p.manifest, base).href;
      const manifestRes = await fetch(manifestUrl, { cache: 'no-cache' });
      if (!manifestRes.ok) throw new Error(`Failed to load pack: ${p.id}`);
      const manifest = await manifestRes.json();
      const manifestBase = manifestUrl.replace(/\/[^/]*$/, '/');
      if (manifest.levels) {
        manifest.levels = manifest.levels.map((level) => ({
          ...level,
          image: this._resolveUrl(level.image, manifestBase, base),
        }));
      }
      this.packs.set(manifest.id, manifest);
    }
  }

  _resolveUrl(url, manifestBase, origin) {
    if (!url || url.startsWith('http')) return url;
    if (url.startsWith('/')) return `${origin}${url}`;
    return new URL(url, manifestBase).href;
  }

  listPacks() {
    return [...this.packs.values()].map((p) => ({
      id: p.id,
      name: p.name || p.id,
      coverImage: p.coverImage,
      count: (p.levels || []).length,
    }));
  }

  getPack(packId) {
    return this.packs.get(packId) || null;
  }

  getLevel(packId, index) {
    const pack = this.getPack(packId);
    if (!pack || !pack.levels?.length) return null;
    const level = pack.levels[index % pack.levels.length];
    return level ? { ...level } : null;
  }
}
