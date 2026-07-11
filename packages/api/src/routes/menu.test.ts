import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import type { MenuEntry } from '@recetario/shared'

vi.mock('../db/menu-repository.js', () => {
  const mockRepo = {
    upsert: vi.fn(),
    remove: vi.fn(),
    getWeek: vi.fn(),
    getScaledIngredients: vi.fn(),
    getShoppingChecks: vi.fn(async () => new Set<string>()),
    setShoppingCheck: vi.fn(),
    updateServings: vi.fn(),
    getDayNutritionInputs: vi.fn(),
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

vi.mock('../db/household-visibility.js', () => ({
  getVisibleOwnerIds: vi.fn(async (ownerId: string) => [ownerId]),
  isViewerAnywhere: vi.fn(async () => false),
}))

vi.mock('../db/pantry-repository.js', () => ({
  pantryRepository: { listInStockNames: vi.fn(async () => [] as string[]) },
}))

vi.mock('../db/ingredient-repository.js', () => ({
  ingredientRepository: {
    loadCanonicalMaps: vi.fn(async () => ({
      synonyms: new Map(),
      canonicals: new Set(),
      displayByKey: new Map(),
      familyByKey: new Map(),
    })),
  },
}))

vi.mock('../db/index.js', () => ({
  getDb: vi.fn(() => {
    throw new Error('DB not available in tests')
  }),
  schema: {},
}))

import { app } from '../index.js'
import { menuRepository } from '../db/menu-repository.js'
import { isViewerAnywhere } from '../db/household-visibility.js'

const mockIsViewer = vi.mocked(isViewerAnywhere)

const mockRepo = menuRepository as unknown as {
  upsert: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
  getWeek: ReturnType<typeof vi.fn>
  getScaledIngredients: ReturnType<typeof vi.fn>
  getShoppingChecks: ReturnType<typeof vi.fn>
  setShoppingCheck: ReturnType<typeof vi.fn>
  updateServings: ReturnType<typeof vi.fn>
  getDayNutritionInputs: ReturnType<typeof vi.fn>
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

const RECIPE_ID = '550e8400-e29b-41d4-a716-446655440000'

describe('DELETE /v1/menu/:date/:slot (clear whole slot)', () => {
  it('returns 204 and removes all recipes in slot', async () => {
    mockRepo.remove.mockResolvedValue(true)

    const res = await app.request('/v1/menu/2026-06-30/Almuerzo', {
      method: 'DELETE',
      headers: AUTH,
    })

    expect(res.status).toBe(204)
    expect(mockRepo.remove).toHaveBeenCalledWith(expect.any(String), '2026-06-30', 'Almuerzo')
  })

  it('returns 404 when slot is empty', async () => {
    mockRepo.remove.mockResolvedValue(false)
    const res = await app.request('/v1/menu/2026-06-30/Cena', { method: 'DELETE', headers: AUTH })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /v1/menu/:date/:slot/:recipeId (remove specific recipe)', () => {
  it('returns 204 when recipe entry exists', async () => {
    mockRepo.remove.mockResolvedValue(true)

    const res = await app.request(`/v1/menu/2026-06-30/Almuerzo/${RECIPE_ID}`, {
      method: 'DELETE',
      headers: AUTH,
    })

    expect(res.status).toBe(204)
    expect(mockRepo.remove).toHaveBeenCalledWith(
      expect.any(String),
      '2026-06-30',
      'Almuerzo',
      RECIPE_ID,
    )
  })

  it('returns 404 when recipe not in slot', async () => {
    mockRepo.remove.mockResolvedValue(false)
    const res = await app.request(`/v1/menu/2026-06-30/Cena/${RECIPE_ID}`, {
      method: 'DELETE',
      headers: AUTH,
    })
    expect(res.status).toBe(404)
  })
})

describe('PATCH /v1/menu/:date/:slot/:recipeId (update servings)', () => {
  it('returns 200 with updated entry', async () => {
    const updated = { ...sampleEntry, servings: 6 }
    mockRepo.updateServings.mockResolvedValue(updated)

    const res = await app.request(`/v1/menu/2026-06-30/Almuerzo/${RECIPE_ID}`, {
      method: 'PATCH',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ servings: 6 }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.servings).toBe(6)
    expect(mockRepo.updateServings).toHaveBeenCalledWith(
      expect.any(String),
      '2026-06-30',
      'Almuerzo',
      RECIPE_ID,
      6,
    )
  })

  it('returns 404 when entry not found', async () => {
    mockRepo.updateServings.mockResolvedValue(null)
    const res = await app.request(`/v1/menu/2026-06-30/Cena/${RECIPE_ID}`, {
      method: 'PATCH',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ servings: 2 }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 400 when servings is invalid', async () => {
    const res = await app.request(`/v1/menu/2026-06-30/Almuerzo/${RECIPE_ID}`, {
      method: 'PATCH',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ servings: 0 }),
    })
    expect(res.status).toBe(400)
    expect(mockRepo.updateServings).not.toHaveBeenCalled()
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
    expect(json).toEqual([
      {
        ingredient: 'pasta',
        quantity: 300,
        unit: 'g',
        key: 'pasta',
        aisle: 'almacen',
        checked: false,
        pantryMatch: false,
      },
    ])
  })

  it('flags pantryMatch when the item is in the in-stock pantry', async () => {
    mockRepo.getScaledIngredients.mockResolvedValue([{ name: 'pasta', quantity: 200, unit: 'g' }])
    const { pantryRepository } = await import('../db/pantry-repository.js')
    ;(pantryRepository.listInStockNames as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      'Pasta',
    ])

    const res = await app.request('/v1/menu/shopping-list?weekStart=2026-06-30', {
      method: 'GET',
      headers: AUTH,
    })
    const json = (await res.json()) as { ingredient: string; pantryMatch: boolean }[]
    expect(json[0]).toMatchObject({ ingredient: 'pasta', pantryMatch: true })
  })

  it('marks an item checked when its normalized key is in the persisted set', async () => {
    mockRepo.getScaledIngredients.mockResolvedValue([
      { name: 'Tomates', quantity: 2, unit: 'unit' },
    ])
    mockRepo.getShoppingChecks.mockResolvedValueOnce(new Set(['tomate']))

    const res = await app.request('/v1/menu/shopping-list?weekStart=2026-06-30', {
      method: 'GET',
      headers: AUTH,
    })

    const json = (await res.json()) as { ingredient: string; checked: boolean; aisle: string }[]
    expect(json[0]).toMatchObject({ ingredient: 'Tomates', checked: true, aisle: 'verduleria' })
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

describe('PUT /v1/menu/shopping-list/check', () => {
  it('persists the check and returns ok', async () => {
    const res = await app.request('/v1/menu/shopping-list/check', {
      method: 'PUT',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekStart: '2026-06-30', key: 'tomate', checked: true }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(mockRepo.setShoppingCheck).toHaveBeenCalledWith(
      expect.any(String),
      '2026-06-30',
      'tomate',
      true,
    )
  })

  it('rejects a bad weekStart (400)', async () => {
    const res = await app.request('/v1/menu/shopping-list/check', {
      method: 'PUT',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekStart: 'nope', key: 'tomate', checked: true }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 401 without auth', async () => {
    const res = await app.request('/v1/menu/shopping-list/check', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekStart: '2026-06-30', key: 'tomate', checked: true }),
    })
    expect(res.status).toBe(401)
  })
})

// Story: household-shared reads + viewer role enforcement (sharing epic story 2).
// Every menu write route must 403 when the caller is a viewer in any household.
describe('viewer role enforcement on menu writes', () => {
  beforeEach(() => {
    mockIsViewer.mockResolvedValue(true)
  })

  it('POST /v1/menu returns 403 for viewers', async () => {
    const res = await app.request('/v1/menu', {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: '2026-06-30',
        slot: 'Almuerzo',
        recipeId: '550e8400-e29b-41d4-a716-446655440000',
        servings: 2,
      }),
    })
    expect(res.status).toBe(403)
    expect(mockRepo.upsert).not.toHaveBeenCalled()
  })

  it('DELETE /v1/menu/:date/:slot/:recipeId returns 403 for viewers', async () => {
    const res = await app.request(
      '/v1/menu/2026-06-30/Almuerzo/550e8400-e29b-41d4-a716-446655440000',
      { method: 'DELETE', headers: AUTH },
    )
    expect(res.status).toBe(403)
    expect(mockRepo.remove).not.toHaveBeenCalled()
  })

  it('DELETE /v1/menu/:date/:slot returns 403 for viewers', async () => {
    const res = await app.request('/v1/menu/2026-06-30/Almuerzo', {
      method: 'DELETE',
      headers: AUTH,
    })
    expect(res.status).toBe(403)
    expect(mockRepo.remove).not.toHaveBeenCalled()
  })

  it('PATCH /v1/menu/:date/:slot/:recipeId returns 403 for viewers', async () => {
    const res = await app.request(
      '/v1/menu/2026-06-30/Almuerzo/550e8400-e29b-41d4-a716-446655440000',
      {
        method: 'PATCH',
        headers: { ...AUTH, 'Content-Type': 'application/json' },
        body: JSON.stringify({ servings: 6 }),
      },
    )
    expect(res.status).toBe(403)
    expect(mockRepo.updateServings).not.toHaveBeenCalled()
  })

  it('GET /v1/menu still works for viewers (read-only access)', async () => {
    mockRepo.getWeek.mockResolvedValue([sampleEntry])
    const res = await app.request('/v1/menu?weekStart=2026-06-30', {
      method: 'GET',
      headers: AUTH,
    })
    expect(res.status).toBe(200)
  })
})

describe('GET /v1/menu/day-nutrition', () => {
  const target = {
    daily_calories: 2000,
    daily_protein_g: 100,
    daily_carbs_g: 250,
    daily_fat_g: 70,
  }

  it('rolls up totals with a signed delta vs the daily target', async () => {
    mockRepo.getDayNutritionInputs.mockResolvedValue({
      entries: [
        {
          mealCategory: 'Almuerzo',
          nutrition: { calories: 500, protein_g: 30, carbs_g: 50, fat_g: 15 },
          servings: 2,
        },
        {
          mealCategory: 'Cena',
          nutrition: { calories: 700, protein_g: 40, carbs_g: 70, fat_g: 20 },
          servings: 1,
        },
      ],
      target,
    })
    const res = await app.request('/v1/menu/day-nutrition?date=2026-07-06', { headers: AUTH })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.date).toBe('2026-07-06')
    expect(body.totals.calories).toBe(1700)
    expect(body.delta.calories).toBe(-300)
    expect(body.byMeal).toHaveLength(2)
    expect(body.partial).toBe(false)
  })

  it('flags partial and returns no delta without a target', async () => {
    mockRepo.getDayNutritionInputs.mockResolvedValue({
      entries: [
        { mealCategory: 'Cena', nutrition: null, servings: 1 },
        {
          mealCategory: 'Cena',
          nutrition: { calories: 400, protein_g: 20, carbs_g: 40, fat_g: 10 },
          servings: 1,
        },
      ],
      target: null,
    })
    const res = await app.request('/v1/menu/day-nutrition?date=2026-07-06', { headers: AUTH })
    const body = await res.json()
    expect(body.partial).toBe(true)
    expect(body.missingCount).toBe(1)
    expect(body.target).toBeNull()
    expect(body.delta).toBeNull()
  })

  it('rejects a malformed date with 400', async () => {
    const res = await app.request('/v1/menu/day-nutrition?date=nope', { headers: AUTH })
    expect(res.status).toBe(400)
  })

  it('returns 401 without auth', async () => {
    const res = await app.request('/v1/menu/day-nutrition?date=2026-07-06')
    expect(res.status).toBe(401)
  })
})
