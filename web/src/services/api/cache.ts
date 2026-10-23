// ==============================================================================
// VetRx — In-Memory API Cache & Request Deduplicator
// Scoped to active practice. Cleared on logout and practice switch.
// Zero persistent browser storage (no localStorage/sessionStorage/IndexedDB).
// ==============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class InMemoryApiCache {
  private cache = new Map<string, CacheEntry<any>>();
  private inFlight = new Map<string, Promise<any>>();
  private activePracticeId: string | null = null;

  /**
   * Set or update active practice context.
   * If practice changes, all existing practice-scoped cache is flushed immediately.
   */
  setPractice(practiceId: string | null) {
    if (this.activePracticeId !== practiceId) {
      this.clear();
      this.activePracticeId = practiceId;
    }
  }

  private buildKey(endpoint: string, params?: Record<string, any>): string {
    const practiceScope = this.activePracticeId || 'global';
    const paramsStr = params ? JSON.stringify(params) : '';
    return `${practiceScope}::${endpoint}::${paramsStr}`;
  }

  /**
   * Fetch with in-memory caching and in-flight request deduplication.
   */
  async dedupeAndCache<T>(
    endpoint: string,
    params: Record<string, any> | undefined,
    fetcher: () => Promise<T>,
    ttlMs: number = 30000 // 30s default TTL
  ): Promise<T> {
    const key = this.buildKey(endpoint, params);
    const now = Date.now();

    // 1. Check valid memory cache
    const existing = this.cache.get(key);
    if (existing && now - existing.timestamp < ttlMs) {
      return existing.data as T;
    }

    // 2. Check if identical request is already in-flight (deduplication)
    const inFlightPromise = this.inFlight.get(key);
    if (inFlightPromise) {
      return inFlightPromise as Promise<T>;
    }

    // 3. Execute fetcher
    const promise = (async () => {
      try {
        const result = await fetcher();
        this.cache.set(key, { data: result, timestamp: Date.now() });
        return result;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    return promise;
  }

  /**
   * Invalidate cached resources matching an endpoint or prefix.
   */
  invalidate(endpointPrefix?: string) {
    if (!endpointPrefix) {
      this.cache.clear();
      return;
    }
    const prefix = `${this.activePracticeId || 'global'}::${endpointPrefix}`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix) || key.includes(`::${endpointPrefix}`)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Completely clear all cache entries and in-flight requests.
   */
  clear() {
    this.cache.clear();
    this.inFlight.clear();
  }
}

export const inMemoryCache = new InMemoryApiCache();
