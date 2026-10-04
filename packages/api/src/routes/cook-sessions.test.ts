import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCreate, mockList, mockRecent, mockStats, mockDays } = vi.hoisted(() => ({
  mockDays: vi.fn(),
  mockCreate: vi.fn(),
  mockList: vi.fn(),
  mockRecent: vi.fn(),
  mockStats: vi.fn(),
}))

vi.mock('../db/cook-sessions-repository.js', () => ({
  cookSessionsRepository: {
    create: mockCreate,
    listByRecipe: mockList,
    listRecent: mockRecent,
    getStats: mockStats,
    cookDays: mockDays,
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
      body: JSON.stringify({
        recipeId: SESSION.recipeId,
        rating: 4,
        notes: 'Great!',
        servings: 3,
        source: 'app',
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.recipeId).toBe(SESSION.recipeId)
    expect(body.rating).toBe(4)
    expect(mockCreate).toHaveBeenCalledWith('dev', SESSION.recipeId, {
      rating: 4,
      notes: 'Great!',
      servings: 3,
      source: 'app',
    })
  })

  it('creates a session without optional fields', async () => {
    mockCreate.mockResolvedValue({ ...SESSION, rating: null, notes: null })
    const res = await app.request('/v1/cook-sessions', {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ recipeId: SESSION.recipeId }),
    })
    expect(res.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith('dev', SESSION.recipeId, {})
  })

  // Auditar 2026-10-03: another household's private recipe was logged (201).
  it('returns 404 when the recipe does not exist or is not visible', async () => {
    mockCreate.mockResolvedValue(null)
    const res = await app.request('/v1/cook-sessions', {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ recipeId: SESSION.recipeId, rating: 1 }),
    })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Recipe not found' })
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

  it("without recipeId returns the user's recent sessions (used by MCP getCookHistory)", async () => {
    mockRecent.mockResolvedValue([SESSION])
    const res = await app.request('/v1/cook-sessions?limit=5', {
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toHaveLength(1)
    expect(mockRecent).toHaveBeenCalledWith('dev', 5, 0)
  })
})

describe('GET /v1/cook-sessions/stats', () => {
  beforeEach(() => mockDays.mockReset().mockResolvedValue({ days: [], today: '2026-10-01' }))

  it('returns stats with topRecipes and frequencyByWeek', async () => {
    mockStats.mockResolvedValue({
      totalSessions: 5,
      topRecipes: [
        { recipeId: SESSION.recipeId, title: 'Milanesas', count: 3, lastCookedAt: new Date() },
      ],
      frequencyByWeek: [{ week: '2026-06-29', count: 2 }],
      windowStart: new Date('2026-04-01T12:00:00Z'),
    })
    const res = await app.request('/v1/cook-sessions/stats', {
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.totalSessions).toBe(5)
    expect(body.topRecipes).toHaveLength(1)
    expect(body.topRecipes[0].title).toBe('Milanesas')
    expect(body.since).toBe('2026-04-01')
    expect(body.frequencyByWeek[0].count).toBe(2)
  })

  it('passes since param to repository', async () => {
    mockStats.mockResolvedValue({
      totalSessions: 0,
      topRecipes: [],
      frequencyByWeek: [],
      windowStart: new Date('2026-01-01'),
    })
    const res = await app.request('/v1/cook-sessions/stats?since=2026-01-01', {
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(200)
    expect(mockStats).toHaveBeenCalledWith('dev', new Date('2026-01-01'))
  })

  // Story "App: pantalla de stats y tendencias": "streak de días consecutivos cocinando".
  it("reports the cooking streak from the caller's local cook days", async () => {
    mockStats.mockResolvedValue({
      totalSessions: 3,
      topRecipes: [],
      frequencyByWeek: [],
      windowStart: new Date('2026-07-03'),
    })
    mockDays.mockResolvedValue({
      days: ['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-30', '2026-10-01'],
      today: '2026-10-01',
    })
    const res = await app.request('/v1/cook-sessions/stats', {
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(200)
    expect((await res.json()).streak).toEqual({ current: 2, longest: 3 })
    expect(mockDays).toHaveBeenCalledWith('dev')
  })

  it('no cooking yet → a zero streak, not a missing field', async () => {
    mockStats.mockResolvedValue({
      totalSessions: 0,
      topRecipes: [],
      frequencyByWeek: [],
      windowStart: new Date('2026-07-03'),
    })
    const res = await app.request('/v1/cook-sessions/stats', {
      headers: { Authorization: 'Bearer test-key' },
    })
    expect((await res.json()).streak).toEqual({ current: 0, longest: 0 })
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
