export class UnsplashProvider {
  constructor({
    accessKey,
    orientation = 'portrait',
    resolution = '720x1280',
    topics = ['mountain landscape', 'forest trees', 'tropical beach', 'food photography', 'wildlife portrait'],
  } = {}) {
    this.accessKey = accessKey;
    this.orientation = orientation;
    this.resolution = resolution;
    this.topics = topics;
    this._topicIndex = 0;
  }

  nextTopic() {
    const t = this.topics[this._topicIndex % this.topics.length];
    this._topicIndex++;
    return t;
  }

  async fetchBatch({ query, page = 1, perPage = 10 } = {}) {
    if (!this.accessKey) return [];

    const q = query || this.nextTopic();
    const [w, h] = this.resolution.split('x');
    const params = new URLSearchParams({
      query: q,
      page: String(page),
      per_page: String(perPage),
      orientation: this.orientation,
      order_by: 'relevant',
    });

    const url = `https://api.unsplash.com/search/photos?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Client-ID ${this.accessKey}`,
        'Accept-Version': 'v1',
      },
    });
    if (!res.ok) return [];

    const data = await res.json();
    const results = data.results || [];

    return results.map((photo) => {
      const raw = photo?.urls?.raw;
      const img = raw ? `${raw}&w=${w}&h=${h}&fit=crop&auto=format&q=85` : '';
      return {
        id: `unsplash-${photo.id}`,
        image: img,
        theme: 'unsplash',
        hint: q,
        grid: 4,
        credit: {
          name: photo?.user?.name || 'Unsplash',
          profile: photo?.user?.links?.html || null,
        },
      };
    });
  }
}
