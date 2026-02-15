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
