export type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

export abstract class BaseAdapter {
  protected cache: Map<string, CacheEntry<any>> = new Map();
  protected cacheTTL: number = 5 * 60 * 1000; // 5 minutes default

  protected getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  protected setCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.cacheTTL,
    });
  }

  protected async fetchWithCache<T>(
    key: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const cached = this.getCached<T>(key);
    if (cached !== null) return cached;

    const data = await fetcher();
    this.setCache(key, data);
    return data;
  }

  protected generateCacheKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|');
    return `${prefix}:${sortedParams}`;
  }
}
