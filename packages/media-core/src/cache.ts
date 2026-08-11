/**
 * Tiny in-memory cache with TTL and LRU-style eviction.
 *
 * Used by the client for single-item lookups. Search/list pages are not
 * cached by default (only de-duplicated in flight) so pagination always
 * reflects fresh provider data.
 */

export interface CacheOptions {
  enabled?: boolean;
  /** Milliseconds before an entry expires. Default: 5 minutes. */
  ttlMs?: number;
  /** Maximum entries before the oldest is evicted. Default: 200. */
  maxEntries?: number;
}

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 200;

export class InMemoryCache {
  private store = new Map<string, CacheEntry>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private enabled: boolean;

  constructor(options: CacheOptions = {}) {
    this.enabled = options.enabled ?? true;
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  }

  get<T>(key: string): T | undefined {
    if (!this.enabled) return undefined;
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set(key: string, value: unknown): void {
    if (!this.enabled) return;
    if (this.store.has(key)) this.store.delete(key);
    else if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next();
      if (!oldest.done) this.store.delete(oldest.value);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.store.clear();
  }
}
