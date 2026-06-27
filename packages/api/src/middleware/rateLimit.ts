import { createMiddleware } from 'hono/factory'

export const requests = new Map<string, number[]>()
const WINDOW_MS = 60_000
const MAX_REQUESTS = 100

export const rateLimitMiddleware = createMiddleware(async (c, next) => {
  const ownerId = c.get('ownerId') ?? c.req.header('x-forwarded-for') ?? 'unknown'
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
