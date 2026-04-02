import { NextResponse } from 'next/server'
import { getClientIp, rateLimitHit, type RateLimitOptions } from '@/lib/api/rate-limit'

export type WithRateLimitOptions = RateLimitOptions & {
  /** Optional endpoint label for logs/keys. */
  endpoint?: string
}

const DEFAULT_OPTIONS: WithRateLimitOptions = {
  limit: 10,
  windowMs: 10_000,
}

export function withRateLimit<T extends (req: Request) => Promise<Response>>(
  handler: T,
  options?: Partial<WithRateLimitOptions>
): (req: Request) => Promise<Response> {
  const opts: WithRateLimitOptions = { ...DEFAULT_OPTIONS, ...(options ?? {}) }
  return async (req: Request) => {
    const ip = getClientIp(req.headers)
    const endpoint = opts.endpoint ?? new URL(req.url).pathname
    const key = `${opts.prefix ?? 'rl'}:${endpoint}:${ip}`
    const hit = rateLimitHit({ key, options: opts })
    if (!hit.allowed) {
      console.warn(`[rate-limit] ip=${ip} endpoint=${endpoint}`)
      return NextResponse.json(
        { error: 'Too many requests, please try again later' },
        { status: 429 }
      )
    }
    return handler(req)
  }
}

