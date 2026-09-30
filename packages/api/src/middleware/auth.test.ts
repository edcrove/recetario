import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the DB module to prevent connection attempts
vi.mock('../db/index.js', () => ({
  getDb: vi.fn(() => {
    throw new Error('DB not available in tests')
  }),
  schema: {},
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

import { app } from '../index.js'

describe('auth middleware', () => {
  const originalEnv = process.env['DEV_API_KEY']

  beforeEach(() => {
    delete process.env['DEV_API_KEY']
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env['DEV_API_KEY'] = originalEnv
    } else {
      delete process.env['DEV_API_KEY']
    }
  })

  it('returns 401 when Authorization header is missing', async () => {
    const res = await app.request('/v1/recipes')
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toContain('Authorization')
  })

  it('returns 401 when Authorization header does not start with Bearer', async () => {
    const res = await app.request('/v1/recipes', {
      headers: { Authorization: 'Basic somekey' },
    })
    expect(res.status).toBe(401)
  })

  it('returns 401 when API key is wrong (no DEV_API_KEY set)', async () => {
    const res = await app.request('/v1/recipes', {
      headers: { Authorization: 'Bearer wrongkey' },
    })
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Invalid API key')
  })

  it('passes when DEV_API_KEY env matches the provided key', async () => {
    process.env['DEV_API_KEY'] = 'test-dev-key-123'

    const res = await app.request('/v1/recipes', {
      headers: { Authorization: 'Bearer test-dev-key-123' },
    })
    expect(res.status).toBe(200)
  })

  it('returns 401 when DEV_API_KEY is set but key does not match', async () => {
    process.env['DEV_API_KEY'] = 'correct-key'

    const res = await app.request('/v1/recipes', {
      headers: { Authorization: 'Bearer wrong-key' },
    })
    expect(res.status).toBe(401)
  })
})
