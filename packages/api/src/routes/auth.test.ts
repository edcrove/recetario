import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Hoisted mocks
const { mockUsersSelect, mockUsersInsert, mockProfileInsert } = vi.hoisted(() => ({
  mockUsersSelect: vi.fn(),
  mockUsersInsert: vi.fn(),
  mockProfileInsert: vi.fn(),
}))

vi.mock('../db/index.js', () => ({
  getDb: vi.fn(() => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(mockUsersSelect()),
        }),
      }),
    }),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    insert: (_t: unknown) => ({
      values: () => ({
        returning: () => Promise.resolve(mockUsersInsert()),
        onConflictDoNothing: () => Promise.resolve(mockProfileInsert()),
      }),
      onConflictDoNothing: () => Promise.resolve(),
    }),
  })),
  schema: {
    users: { email: 'email', id: 'id' },
    userProfiles: {},
  },
}))

vi.mock('../db/repository.js', () => ({
  recipeRepository: {
    list: vi.fn().mockResolvedValue([]),
    search: vi.fn().mockResolvedValue([]),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
  },
}))

vi.mock('../db/menu-repository.js', () => ({
  menuRepository: {
    getWeek: vi.fn().mockResolvedValue([]),
    upsert: vi.fn(),
    remove: vi.fn(),
    getScaledIngredients: vi.fn().mockResolvedValue([]),
  },
}))

import { app } from '../index.js'
import { authRequests } from '../middleware/rateLimit.js'

// Every request here comes from the same (unknown) IP; keep the auth limiter
// out of the way except in the burst test that exercises it.
beforeEach(() => authRequests.clear())

const DEMO_USER = {
  id: 'user-001',
  email: 'test@test.com',
  passwordHash: '$2b$12$somehashedvalue', // won't be verified in unit tests
  displayName: 'Test User',
  avatarUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('POST /auth/register', () => {
  beforeEach(() => {
    mockUsersSelect.mockReturnValue([])
    mockUsersInsert.mockReturnValue([DEMO_USER])
    mockProfileInsert.mockReturnValue([])
  })

  it('returns 201 with user and JWT token on success', async () => {
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@test.com',
        password: 'password123',
        displayName: 'Test',
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.user.email).toBe('test@test.com')
    expect(typeof body.token).toBe('string')
  })

  it('returns 403 when registration is closed', async () => {
    vi.stubEnv('REGISTRATION_OPEN', 'false')
    const insertsBefore = mockUsersInsert.mock.calls.length
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@test.com', password: 'password123' }),
    })
    vi.unstubAllEnvs()
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Registration is closed' })
    expect(mockUsersInsert.mock.calls.length).toBe(insertsBefore)
  })

  it('returns 409 when email is already registered', async () => {
    mockUsersSelect.mockReturnValue([DEMO_USER])

    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'password123' }),
    })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('already registered')
  })

  it('returns 400 for invalid body (password too short)', async () => {
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'short' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 201 without displayName (uses null fallback)', async () => {
    mockUsersInsert.mockReturnValue([{ ...DEMO_USER, displayName: null }])
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'password123' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.user.displayName).toBeNull()
  })

  it('returns 400 for invalid email', async () => {
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'password123' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('POST /auth/login', () => {
  it('returns 401 when user not found', async () => {
    mockUsersSelect.mockReturnValue([])

    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'unknown@test.com', password: 'password123' }),
    })
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toContain('Invalid')
  })

  it('returns 200 with token when credentials match', async () => {
    // Use a real bcrypt hash for 'password123'
    const { hashPassword } = await import('../auth/service.js')
    const hash = await hashPassword('password123')
    mockUsersSelect.mockReturnValue([{ ...DEMO_USER, passwordHash: hash }])

    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'password123' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(typeof body.token).toBe('string')
    expect(body.user.email).toBe('test@test.com')
  })

  it('returns 401 when password is wrong', async () => {
    const { hashPassword } = await import('../auth/service.js')
    const hash = await hashPassword('correct-password')
    mockUsersSelect.mockReturnValue([{ ...DEMO_USER, passwordHash: hash }])

    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'wrong-password' }),
    })
    expect(res.status).toBe(401)
  })
})

describe('GET /auth/me', () => {
  it('returns 401 with no Authorization header', async () => {
    const res = await app.request('/auth/me')
    expect(res.status).toBe(401)
  })

  it('returns 401 with invalid JWT', async () => {
    const res = await app.request('/auth/me', {
      headers: { Authorization: 'Bearer invalid.token.here' },
    })
    expect(res.status).toBe(401)
  })

  it('returns 200 with user data for valid JWT', async () => {
    const { signJwt } = await import('../auth/service.js')
    const token = await signJwt({ sub: DEMO_USER.id, email: DEMO_USER.email })
    mockUsersSelect.mockReturnValue([DEMO_USER])

    const res = await app.request('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.email).toBe('test@test.com')
    expect(body.id).toBe('user-001')
  })

  it('returns 401 when user from JWT no longer exists in DB', async () => {
    const { signJwt } = await import('../auth/service.js')
    const token = await signJwt({ sub: 'deleted-user', email: 'gone@test.com' })
    mockUsersSelect.mockReturnValue([])

    const res = await app.request('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toContain('not found')
  })
})

describe('auth rate limit (per IP)', () => {
  // The integration config raises the limit for the whole run; pin the default
  beforeEach(() => {
    vi.stubEnv('AUTH_RATE_LIMIT_MAX_REQUESTS', undefined)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 429 with Retry-After after 10 login attempts from one IP in a minute', async () => {
    mockUsersSelect.mockReturnValue([])
    const attempt = (ip: string) =>
      app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
        body: JSON.stringify({ email: 'x@test.com', password: 'wrongpass' }),
      })

    for (let i = 0; i < 10; i++) {
      expect((await attempt('203.0.113.7')).status).toBe(401)
    }
    const blocked = await attempt('203.0.113.7')
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('Retry-After')).toBe('60')
    expect((await blocked.json()).error).toMatch(/too many attempts/i)

    // Another client is unaffected
    expect((await attempt('198.51.100.1')).status).toBe(401)
  })

  it('counts register attempts in the same per-IP window', async () => {
    mockUsersSelect.mockReturnValue([DEMO_USER])
    const register = () =>
      app.request('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.9' },
        body: JSON.stringify({ email: 'test@test.com', password: 'password123' }),
      })
    for (let i = 0; i < 10; i++) expect((await register()).status).toBe(409)
    expect((await register()).status).toBe(429)
  })

  it('does not limit GET /auth/me', async () => {
    for (let i = 0; i < 12; i++) {
      expect((await app.request('/auth/me')).status).toBe(401)
    }
  })
})
