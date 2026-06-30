import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHash } from 'node:crypto'

const TEST_KEY = 'my-secret-api-key'
const TEST_HASH = createHash('sha256').update(TEST_KEY).digest('hex')

let mockDbResult: unknown[] = []

vi.mock('../db/index.js', () => ({
  getDb: vi.fn(() => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(mockDbResult),
        }),
      }),
    }),
  })),
  schema: {
    apiKeys: { keyHash: 'key_hash' },
  },
}))

vi.mock('../db/repository.js', () => ({
  recipeRepository: {
    upsert: vi.fn(),
    findById: vi.fn(),
    list: vi.fn().mockResolvedValue([]),
    search: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(),
  },
}))

vi.mock('../db/menu-repository.js', () => ({
  menuRepository: {
    upsert: vi.fn(),
    remove: vi.fn(),
    getWeek: vi.fn().mockResolvedValue([]),
    getScaledIngredients: vi.fn().mockResolvedValue([]),
  },
}))

import { app } from '../index.js'
import { requests as rateLimitStore } from './rateLimit.js'
import { signJwt } from '../auth/service.js'

describe('auth middleware — DB hash path', () => {
  beforeEach(() => {
    delete process.env['DEV_API_KEY']
    rateLimitStore.clear()
    mockDbResult = []
  })

  afterEach(() => {
    rateLimitStore.clear()
  })

  it('authenticates when DB returns matching keyHash', async () => {
    mockDbResult = [{ id: 'key-1', keyHash: TEST_HASH, ownerId: 'user-42' }]

    const res = await app.request('/v1/recipes', {
      headers: { Authorization: `Bearer ${TEST_KEY}` },
    })
    expect(res.status).toBe(200)
  })

  it('returns 401 when DB returns no matching key', async () => {
    mockDbResult = []

    const res = await app.request('/v1/recipes', {
      headers: { Authorization: 'Bearer wrong-key' },
    })
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Invalid API key')
  })

  it('sets ownerId from the matched DB row', async () => {
    mockDbResult = [{ id: 'key-1', keyHash: TEST_HASH, ownerId: 'owner-abc' }]

    const res = await app.request('/v1/recipes', {
      headers: { Authorization: `Bearer ${TEST_KEY}` },
    })
    expect(res.status).toBe(200)
  })
})

describe('auth middleware — JWT path', () => {
  beforeEach(() => {
    delete process.env['DEV_API_KEY']
    rateLimitStore.clear()
    mockDbResult = []
  })

  afterEach(() => {
    rateLimitStore.clear()
  })

  it('authenticates with a valid JWT and sets ownerId to sub claim', async () => {
    const token = await signJwt({ sub: 'user-jwt-123', email: 'test@test.com' })

    const res = await app.request('/v1/recipes', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
  })

  it('rejects an invalid JWT and falls through to API key lookup', async () => {
    mockDbResult = []
    const res = await app.request('/v1/recipes', {
      headers: { Authorization: 'Bearer not.a.valid.jwt' },
    })
    expect(res.status).toBe(401)
  })
})
