import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Hono } from 'hono'
import {
  authRateLimitMiddleware,
  authRequests,
  clientIp,
  rateLimitMiddleware,
  requests,
} from './rateLimit.js'

function recipesApp() {
  const app = new Hono<{ Variables: { ownerId: string } }>()
  app.use('*', async (c, next) => {
    c.set('ownerId', c.req.header('x-owner') ?? 'owner-a')
    await next()
  })
  app.use('*', rateLimitMiddleware)
  app.all('/r', (c) => c.text('ok'))
  return app
}

function authApp() {
  const app = new Hono()
  app.use('*', authRateLimitMiddleware)
  app.post('/login', (c) => c.text('ok'))
  return app
}

beforeEach(() => {
  requests.clear()
  authRequests.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('rateLimitMiddleware (per owner, writes only)', () => {
  it('returns 429 after 100 writes from the same owner in a minute', async () => {
    const app = recipesApp()
    for (let i = 0; i < 100; i++) {
      expect((await app.request('/r', { method: 'POST' })).status).toBe(200)
    }
    const res = await app.request('/r', { method: 'PUT' })
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'Rate limit exceeded' })
    // A different owner has its own window
    expect(
      (await app.request('/r', { method: 'DELETE', headers: { 'x-owner': 'b' } })).status,
    ).toBe(200)
  })

  it('never limits or tracks reads', async () => {
    const app = recipesApp()
    requests.set(
      'owner-a',
      Array.from({ length: 100 }, () => Date.now()),
    )
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      expect((await app.request('/r', { method })).status).toBe(200)
    }
    expect(requests.get('owner-a')).toHaveLength(100)
  })

  it('evicts timestamps older than the 60s window', async () => {
    const app = recipesApp()
    const now = Date.now()
    requests.set(
      'owner-a',
      Array.from({ length: 100 }, (_, i) => now - 61_000 - i),
    )
    expect((await app.request('/r', { method: 'POST' })).status).toBe(200)
    expect(requests.get('owner-a')).toHaveLength(1)
  })

  it('sweeps keys whose window is empty, at most once per window', async () => {
    vi.useFakeTimers()
    const app = recipesApp()
    // Start past any sweep an earlier test did with the real clock
    const t0 = Date.now() + 10 * 60_000
    vi.setSystemTime(t0)
    await app.request('/r', { method: 'POST', headers: { 'x-owner': 'stale' } })

    // Within the same window the stale key survives (no sweep yet)
    vi.setSystemTime(t0 + 30_000)
    await app.request('/r', { method: 'POST' })
    expect(requests.has('stale')).toBe(true)

    vi.setSystemTime(t0 + 55_000)
    await app.request('/r', { method: 'POST', headers: { 'x-owner': 'fresh' } })

    // Once a full window has passed, the next request sweeps empty windows only
    vi.setSystemTime(t0 + 61_000)
    await app.request('/r', { method: 'POST' })
    expect(requests.has('stale')).toBe(false)
    expect(requests.has('fresh')).toBe(true)
    expect(requests.has('owner-a')).toBe(true)
  })
})

describe('authRateLimitMiddleware (per IP)', () => {
  // The integration config raises the limit for the whole run; pin the default
  beforeEach(() => {
    vi.stubEnv('AUTH_RATE_LIMIT_MAX_REQUESTS', undefined)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 429 with Retry-After after 10 attempts from one IP', async () => {
    const app = authApp()
    const headers = { 'X-Forwarded-For': '203.0.113.7' }
    for (let i = 0; i < 10; i++) {
      expect((await app.request('/login', { method: 'POST', headers })).status).toBe(200)
    }
    const res = await app.request('/login', { method: 'POST', headers })
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('60')
  })
})

describe('clientIp', () => {
  const ipOf = async (headers: Record<string, string>, env?: unknown) => {
    const app = new Hono()
    app.get('/', (c) => c.text(clientIp(c)))
    return (await app.request('/', { headers }, env)).text()
  }

  it('uses the rightmost X-Forwarded-For entry (the one the proxy appended)', async () => {
    expect(await ipOf({ 'X-Forwarded-For': '1.1.1.1, 10.0.0.1 , 203.0.113.7 ' })).toBe(
      '203.0.113.7',
    )
  })

  it('falls back to the socket address when the header is missing or blank', async () => {
    const env = { incoming: { socket: { remoteAddress: '192.0.2.4' } } }
    expect(await ipOf({}, env)).toBe('192.0.2.4')
    expect(await ipOf({ 'X-Forwarded-For': ' , ' }, env)).toBe('192.0.2.4')
  })

  it('returns "unknown" when neither is available', async () => {
    expect(await ipOf({})).toBe('unknown')
  })
})
