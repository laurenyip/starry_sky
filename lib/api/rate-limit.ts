import { LRUCache } from 'lru-cache'

export type RateLimitOptions = {
  /** Max requests allowed in window. */
  limit: number
  /** Window length in ms. */
  windowMs: number
  /** Optional prefix for key names. */
  prefix?: string
}

type Entry = { count: number; resetAt: number }

const cache = new LRUCache<string, Entry>({
  max: 10_000,
  ttl: 60 * 60 * 1000,
})

export function getClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const xr = headers.get('x-real-ip')?.trim()
  if (xr) return xr
  const cf = headers.get('cf-connecting-ip')?.trim()
  if (cf) return cf
  return 'unknown'
}

export function rateLimitHit(params: {
  key: string
  now?: number
  options: RateLimitOptions
}): { allowed: boolean; remaining: number; resetAt: number } {
  const now = params.now ?? Date.now()
  const { limit, windowMs } = params.options
  const entry = cache.get(params.key)
  if (!entry || entry.resetAt <= now) {
    const next: Entry = { count: 1, resetAt: now + windowMs }
    cache.set(params.key, next, { ttl: windowMs })
    return { allowed: true, remaining: limit - 1, resetAt: next.resetAt }
  }
  const nextCount = entry.count + 1
  const next: Entry = { count: nextCount, resetAt: entry.resetAt }
  cache.set(params.key, next, { ttl: entry.resetAt - now })
  return {
    allowed: nextCount <= limit,
    remaining: Math.max(0, limit - nextCount),
    resetAt: entry.resetAt,
  }
}

