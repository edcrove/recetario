import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'

const WINDOW_MS = 60_000

type Store = Map<string, number[]>

/**
 * Sliding-window check for one key. Returns false when the key is over `max`.
 * Keys whose window is empty are deleted, and the whole store is swept at most
 * once per window so keys that never come back (e.g. one-off IPs) don't pile up.
 */
function allow(store: Store, key: string, max: number, now: number): boolean {
  const windowStart = now - WINDOW_MS
  sweep(store, windowStart, now)
  const times = (store.get(key) ?? []).filter((t) => t > windowStart)
  if (times.length >= max) {
    store.set(key, times)
    return false
  }
  times.push(now)
  store.set(key, times)
  return true
}

const lastSweep = new WeakMap<Store, number>()

function sweep(store: Store, windowStart: number, now: number) {
  if (now - (lastSweep.get(store) ?? 0) < WINDOW_MS) return
  lastSweep.set(store, now)
  for (const [key, times] of store) {
    if (!times.some((t) => t > windowStart)) store.delete(key)
  }
}

// ── Per-account limiter for recipe writes ────────────────────────────────────

export const requests: Store = new Map()
// Overridable for E2E/CI, where several parallel workers legitimately share
// this window per account (login + queries across many spec files).
const MAX_REQUESTS = Number(process.env['RATE_LIMIT_MAX_REQUESTS'] ?? 100)
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export const rateLimitMiddleware = createMiddleware(async (c, next) => {
  if (READ_METHODS.has(c.req.method)) return next()
  if (!allow(requests, c.get('ownerId'), MAX_REQUESTS, Date.now())) {
    return c.json({ error: 'Rate limit exceeded' }, 429)
  }
  await next()
})

// ── Per-IP limiter for unauthenticated auth endpoints ────────────────────────

export const authRequests: Store = new Map()
// Brute-force guard for /auth/login and /auth/register. E2E and the integration
// suite log in many times from one IP, so they raise it via env (read per request).
const authMaxRequests = () => Number(process.env['AUTH_RATE_LIMIT_MAX_REQUESTS'] ?? 10)

/**
 * Client IP. Behind a proxy (Railway) the proxy appends the address it saw to
 * X-Forwarded-For, so the rightmost entry is the one a client can't forge
 * (assumes a single proxy hop). The header is only trusted with
 * TRUST_PROXY=true — without a proxy a client could set it and pick its own
 * rate-limit key. Otherwise, and when it's blank, the socket address is used.
 */
export function clientIp(c: Context): string {
  const forwarded =
    process.env['TRUST_PROXY'] === 'true' ? c.req.header('x-forwarded-for') : undefined
  if (forwarded) {
    const last = forwarded.split(',').at(-1)?.trim()
    if (last) return last
  }
  const env = c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined
  return env?.incoming?.socket?.remoteAddress ?? 'unknown'
}

export const authRateLimitMiddleware = createMiddleware(async (c, next) => {
  if (!allow(authRequests, clientIp(c), authMaxRequests(), Date.now())) {
    c.header('Retry-After', String(WINDOW_MS / 1000))
    return c.json({ error: 'Too many attempts, try again in a minute' }, 429)
  }
  await next()
})
