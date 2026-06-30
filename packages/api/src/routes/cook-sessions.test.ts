import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCreate, mockList, mockStats } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockList: vi.fn(),
  mockStats: vi.fn(),
}))

vi.mock('../db/cook-sessions-repository.js', () => ({
  cookSessionsRepository: {
    create: mockCreate,
    listByRecipe: mockList,
    getStats: mockStats,
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
vi.mock('../db/index.js', () => ({
  getDb: vi.fn(() => {
    throw new Error('no db')
  }),
  schema: {},
}))

import { app } from '../index.js'
import { requests as rateLimitStore } from '../middleware/rateLimit.js'

const AUTH = { Authorization: 'Bearer test-key', 'Content-Type': 'application/json' }
const SESSION = {
  id: 's1',
  recipeId: '550e8400-e29b-41d4-a716-446655440000',
  ownerId: 'dev',
  cookedAt: new Date(),
  rating: 4,
  notes: 'Great!',
  createdAt: new Date(),
}

beforeEach(() => {
  process.env['DEV_API_KEY'] = 'test-key'
  rateLimitStore.clear()
  mockCreate.mockReset()
  mockList.mockReset()
  mockStats.mockReset()
})

describe('POST /v1/cook-sessions', () => {
  it('creates a session and returns 201', async () => {
    mockCreate.mockResolvedValue(SESSION)
    const res = await app.request('/v1/cook-sessions', {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ recipeId: SESSION.recipeId, rating: 4, notes: 'Great!' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.recipeId).toBe(SESSION.recipeId)
    expect(body.rating).toBe(4)
    expect(mockCreate).toHaveBeenCalledWith('dev', SESSION.recipeId, 4, 'Great!')
  })

  it('creates a session without optional fields', async () => {
    mockCreate.mockResolvedValue({ ...SESSION, rating: null, notes: null })
    const res = await app.request('/v1/cook-sessions', {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ recipeId: SESSION.recipeId }),
    })
    expect(res.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith('dev', SESSION.recipeId, undefined, undefined)
  })

  it('returns 400 for invalid rating', async () => {
    const res = await app.request('/v1/cook-sessions', {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ recipeId: SESSION.recipeId, rating: 6 }),
    })
    expect(res.status).toBe(400)
  })
})

describe('GET /v1/cook-sessions', () => {
  it('returns sessions for a recipeId', async () => {
    mockList.mockResolvedValue([SESSION])
    const res = await app.request(`/v1/cook-sessions?recipeId=${SESSION.recipeId}`, {
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].rating).toBe(4)
  })

  it('returns 400 when recipeId is missing', async () => {
    const res = await app.request('/v1/cook-sessions', {
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(400)
  })
})

describe('GET /v1/cook-sessions/stats', () => {
  it('returns stats with topRecipes and frequencyByWeek', async () => {
    mockStats.mockResolvedValue({
      totalSessions: 5,
      topRecipes: [{ recipeId: SESSION.recipeId, count: 3, lastCookedAt: new Date() }],
      frequencyByWeek: [{ week: '2026-06-29', count: 2 }],
    })
    const res = await app.request('/v1/cook-sessions/stats', {
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.totalSessions).toBe(5)
    expect(body.topRecipes).toHaveLength(1)
    expect(body.frequencyByWeek[0].count).toBe(2)
  })

  it('passes since param to repository', async () => {
    mockStats.mockResolvedValue({ totalSessions: 0, topRecipes: [], frequencyByWeek: [] })
    const res = await app.request('/v1/cook-sessions/stats?since=2026-01-01', {
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(200)
    expect(mockStats).toHaveBeenCalledWith('dev', new Date('2026-01-01'))
  })
})

describe('GET /v1/cook-sessions/recipes/:id', () => {
  it('lists sessions for a specific recipe', async () => {
    mockList.mockResolvedValue([SESSION])
    const res = await app.request(`/v1/cook-sessions/recipes/${SESSION.recipeId}`, {
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
  })
})
