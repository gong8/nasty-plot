/**
 * Simple in-memory TTL cache.
 * Used to avoid redundant DB queries for frequently-accessed, rarely-changing data.
 */
export class TTLCache<T> {
  private cache = new Map<string, { value: T; expiresAt: number }>()
  private defaultTtlMs: number

  constructor(ttlMs: number) {
    this.defaultTtlMs = ttlMs
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return undefined
    }
    return entry.value
  }

  set(key: string, value: T, ttlMs?: number): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    })
  }

  invalidate(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }
}

/**
 * LRU cache with TTL expiry and bounded size.
 * Evicts least-recently-used entries when maxSize is exceeded.
 * Uses Map insertion order for O(1) LRU tracking (delete + re-insert on access).
 */
export class LRUCache<T> {
  private cache = new Map<string, { value: T; expiresAt: number }>()
  private readonly maxSize: number
  private readonly defaultTtlMs: number

  constructor(maxSize: number, ttlMs: number) {
    this.maxSize = maxSize
    this.defaultTtlMs = ttlMs
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return undefined
    }
    // Move to end (most recently used) by re-inserting
    this.cache.delete(key)
    this.cache.set(key, entry)
    return entry.value
  }

  set(key: string, value: T, ttlMs?: number): void {
    // If key already exists, delete first to refresh position
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }
    // Evict oldest (least recently used) entries if at capacity
    while (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value
      if (oldest !== undefined) {
        this.cache.delete(oldest)
      } else {
        break
      }
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    })
  }

  get size(): number {
    return this.cache.size
  }

  invalidate(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }
}
