import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import type { MenuEntry } from '@recetario/shared'

vi.mock('../db/menu-repository.js', () => {
  const mockRepo = {
    upsert: vi.fn(),
    remove: vi.fn(),
    getWeek: vi.fn(),
    getScaledIngredients: vi.fn(),
  }
  return {
    menuRepository: mockRepo,
    MenuRepository: vi.fn(() => mockRepo),
  }
})

vi.mock('../db/repository.js', () => ({
  recipeRepository: {},
  RecipeRepository: vi.fn(),
}))

vi.mock('../db/index.js', () => ({
  getDb: vi.fn(() => {
    throw new Error('DB not available in tests')
  }),
  schema: {},
}))

import { app } from '../index.js'
import { menuRepository } from '../db/menu-repository.js'

const mockRepo = menuRepository as unknown as {
  upsert: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
  getWeek: ReturnType<typeof vi.fn>
  getScaledIngredients: ReturnType<typeof vi.fn>
}

const DEV_KEY = 'menu-test-key'
const AUTH = { Authorization: `Bearer ${DEV_KEY}` }

const sampleEntry: MenuEntry = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  ownerId: 'owner-1',
  date: '2026-06-30',
  slot: 'Almuerzo',
  recipeId: '550e8400-e29b-41d4-a716-446655440000',
  servings: 4,
  recipeName: 'Tortilla española',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

beforeAll(() => {
  process.env['DEV_API_KEY'] = DEV_KEY
})

afterAll(() => {
  delete process.env['DEV_API_KEY']
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /v1/menu', () => {
  it('returns 200 with upserted entry', async () => {
    mockRepo.upsert.mockResolvedValue(sampleEntry)

    const res = await app.request('/v1/menu', {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: '2026-06-30',
        slot: 'Almuerzo',
        recipeId: '550e8400-e29b-41d4-a716-446655440000',
        servings: 4,
      }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toMatchObject({ date: '2026-06-30', slot: 'Almuerzo' })
    expect(mockRepo.upsert).toHaveBeenCalledOnce()
  })

  it('returns 400 on invalid body', async () => {
    const res = await app.request('/v1/menu', {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: 'not-a-date', slot: 'Almuerzo', recipeId: 'bad-uuid' }),
    })

    expect(res.status).toBe(400)
    expect(mockRepo.upsert).not.toHaveBeenCalled()
  })

  it('returns 401 without auth', async () => {
    const res = await app.request('/v1/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: '2026-06-30',
        slot: 'Almuerzo',
        recipeId: '550e8400-e29b-41d4-a716-446655440000',
      }),
    })

    expect(res.status).toBe(401)
  })
})

describe('DELETE /v1/menu/:date/:slot', () => {
  it('returns 204 when entry exists', async () => {
    mockRepo.remove.mockResolvedValue(true)

    const res = await app.request('/v1/menu/2026-06-30/Almuerzo', {
      method: 'DELETE',
      headers: AUTH,
    })

    expect(res.status).toBe(204)
    expect(mockRepo.remove).toHaveBeenCalledWith(expect.any(String), '2026-06-30', 'Almuerzo')
  })

  it('returns 404 when entry not found', async () => {
    mockRepo.remove.mockResolvedValue(false)

    const res = await app.request('/v1/menu/2026-06-30/Cena', {
      method: 'DELETE',
      headers: AUTH,
    })

    expect(res.status).toBe(404)
  })
})

describe('GET /v1/menu', () => {
  it('returns 200 with week entries', async () => {
    mockRepo.getWeek.mockResolvedValue([sampleEntry])

    const res = await app.request('/v1/menu?weekStart=2026-06-30', {
      method: 'GET',
      headers: AUTH,
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveLength(1)
    expect(json[0]).toMatchObject({ slot: 'Almuerzo' })
    expect(mockRepo.getWeek).toHaveBeenCalledWith(expect.any(String), '2026-06-30')
  })

  it('returns 200 with empty array when no entries', async () => {
    mockRepo.getWeek.mockResolvedValue([])

    const res = await app.request('/v1/menu?weekStart=2026-06-30', {
      method: 'GET',
      headers: AUTH,
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('returns 400 when weekStart is missing', async () => {
    const res = await app.request('/v1/menu', {
      method: 'GET',
      headers: AUTH,
    })

    expect(res.status).toBe(400)
  })
})

describe('GET /v1/menu/shopping-list', () => {
  it('returns 200 with aggregated shopping list', async () => {
    mockRepo.getScaledIngredients.mockResolvedValue([
      { name: 'pasta', quantity: 200, unit: 'g' },
      { name: 'pasta', quantity: 100, unit: 'g' },
    ])

    const res = await app.request('/v1/menu/shopping-list?weekStart=2026-06-30', {
      method: 'GET',
      headers: AUTH,
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual([{ ingredient: 'pasta', quantity: 300, unit: 'g' }])
  })

  it('returns empty array when no menu entries', async () => {
    mockRepo.getScaledIngredients.mockResolvedValue([])

    const res = await app.request('/v1/menu/shopping-list?weekStart=2026-06-30', {
      method: 'GET',
      headers: AUTH,
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('returns 400 when weekStart is missing', async () => {
    const res = await app.request('/v1/menu/shopping-list', {
      method: 'GET',
      headers: AUTH,
    })

    expect(res.status).toBe(400)
  })

  it('returns 401 without auth', async () => {
    const res = await app.request('/v1/menu/shopping-list?weekStart=2026-06-30', {
      method: 'GET',
    })

    expect(res.status).toBe(401)
  })
})
