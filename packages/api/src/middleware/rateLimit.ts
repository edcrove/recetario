import { createMiddleware } from 'hono/factory'

export const requests = new Map<string, number[]>()
const WINDOW_MS = 60_000
// Overridable for E2E/CI, where several parallel workers legitimately share
// this window per account (login + queries across many spec files).
const MAX_REQUESTS = Number(process.env['RATE_LIMIT_MAX_REQUESTS'] ?? 100)

export const rateLimitMiddleware = createMiddleware(async (c, next) => {
  const ownerId = c.get('ownerId')
  const now = Date.now()
  const windowStart = now - WINDOW_MS

  const times = (requests.get(ownerId) ?? []).filter((t) => t > windowStart)
  if (times.length >= MAX_REQUESTS) {
    return c.json({ error: 'Rate limit exceeded' }, 429)
  }
  times.push(now)
  requests.set(ownerId, times)

  await next()
})
