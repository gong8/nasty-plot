interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

interface RateLimitEntry {
  timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < 600_000) // 10 min max
    if (entry.timestamps.length === 0) store.delete(key)
  }
}, 60_000)

export function checkRateLimit(
  ip: string,
  config: RateLimitConfig,
): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now()
  const entry = store.get(ip) ?? { timestamps: [] }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < config.windowMs)

  if (entry.timestamps.length >= config.maxRequests) {
    const oldestInWindow = entry.timestamps[0]
    const retryAfterMs = config.windowMs - (now - oldestInWindow)
    return { allowed: false, retryAfterMs }
  }

  entry.timestamps.push(now)
  store.set(ip, entry)
  return { allowed: true }
}
