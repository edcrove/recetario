import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'

vi.mock('../db/pantry-repository.js', () => ({
  pantryRepository: {
    listInStockNames: vi.fn(async () => [] as string[]),
    listHouseholdRecipesWithIngredients: vi.fn(async () => []),
  },
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
vi.mock('../db/menu-repository.js', () => ({
  menuRepository: { getDayNutritionInputs: vi.fn(async () => ({ entries: [], target: null })) },
}))
vi.mock('../db/index.js', () => ({
  getDb: vi.fn(() => {
    throw new Error('DB not available in tests')
  }),
  schema: {},
}))

import { app } from '../index.js'
import { pantryRepository } from '../db/pantry-repository.js'
import { menuRepository } from '../db/menu-repository.js'

const mockPantry = pantryRepository as unknown as {
  listInStockNames: ReturnType<typeof vi.fn>
  listHouseholdRecipesWithIngredients: ReturnType<typeof vi.fn>
}
const mockMenu = menuRepository as unknown as { getDayNutritionInputs: ReturnType<typeof vi.fn> }

const DEV_KEY = 'suggestions-test-key'
const AUTH = { Authorization: `Bearer ${DEV_KEY}`, 'Content-Type': 'application/json' }

const recipe = (id: string, title: string, ings: string[], nutrition: unknown = null) => ({
  id,
  title,
  ingredients: ings,
  nutrition,
})

beforeAll(() => {
  process.env['DEV_API_KEY'] = DEV_KEY
})
afterAll(() => {
  delete process.env['DEV_API_KEY']
})
beforeEach(() => vi.clearAllMocks())

async function post(body: object) {
  return app.request('/v1/suggestions/from-ingredients', {
    method: 'POST',
    headers: AUTH,
    body: JSON.stringify(body),
  })
}

describe('POST /v1/suggestions/from-ingredients', () => {
  it('ranks recipes by ad-hoc ingredient coverage', async () => {
    mockPantry.listHouseholdRecipesWithIngredients.mockResolvedValue([
      recipe('a', 'Falta', ['pollo', 'arroz', 'sal']),
      recipe('b', 'Completa', ['pollo', 'arroz']),
    ])
    const res = await post({ ingredients: ['pollo', 'arroz'] })
    expect(res.status).toBe(200)
    const list = (await res.json()) as { id: string; goalFit: null }[]
    expect(list[0]!.id).toBe('b')
    expect(list[0]!.goalFit).toBeNull()
  })

  it('uses the in-stock pantry when usePantry is set', async () => {
    mockPantry.listInStockNames.mockResolvedValue(['pollo'])
    mockPantry.listHouseholdRecipesWithIngredients.mockResolvedValue([
      recipe('a', 'Pollo', ['pollo']),
    ])
    const res = await post({ usePantry: true })
    expect(res.status).toBe(200)
    expect(mockPantry.listInStockNames).toHaveBeenCalled()
    expect((await res.json())[0].matchedCount).toBe(1)
  })

  it('computes goalFit from the remaining daily target when a date is given', async () => {
    mockMenu.getDayNutritionInputs.mockResolvedValue({
      entries: [],
      target: { daily_calories: 500, daily_protein_g: 0, daily_carbs_g: 0, daily_fat_g: 0 },
    })
    mockPantry.listHouseholdRecipesWithIngredients.mockResolvedValue([
      recipe('a', 'Justa', ['pollo'], { calories: 480, protein_g: 0, carbs_g: 0, fat_g: 0 }),
    ])
    const res = await post({ ingredients: ['pollo'], date: '2026-07-13' })
    expect(res.status).toBe(200)
    expect((await res.json())[0].goalFit).toBe('dentro')
  })

  it('400s when neither ingredients nor usePantry is provided', async () => {
    const res = await post({})
    expect(res.status).toBe(400)
  })

  it('401s without auth', async () => {
    const res = await app.request('/v1/suggestions/from-ingredients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredients: ['pollo'] }),
    })
    expect(res.status).toBe(401)
  })
})
