import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSelect, mockUpdate, mockInsert } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockInsert: vi.fn(),
}))

vi.mock('../db/index.js', () => ({
  getDb: vi.fn(() => ({
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            and: () => Promise.resolve(mockSelect()),
            then: (r: (v: unknown) => void) => r(mockSelect()),
          }),
          then: (r: (v: unknown) => void) => r(mockSelect()),
        }),
        where: () => ({
          limit: () => Promise.resolve(mockSelect()),
          then: (r: (v: unknown) => void) => r(mockSelect()),
        }),
        orderBy: () => Promise.resolve(mockSelect()),
      }),
    }),
    update: () => ({
      set: () => ({ where: () => ({ returning: () => Promise.resolve(mockUpdate()) }) }),
    }),
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: () => ({
          returning: () => Promise.resolve(mockSelect()),
        }),
        onConflictDoNothing: () => Promise.resolve([]),
        returning: () => Promise.resolve(mockInsert()),
      }),
    }),
  })),
  schema: {
    userProfiles: { userId: 'user_id', nutritionTargets: 'nutrition_targets' },
    menuEntries: { ownerId: 'owner_id', date: 'date', recipeId: 'recipe_id', servings: 'servings' },
    recipes: {
      id: 'id',
      servings: 'servings',
      nutrition: 'nutrition',
      dietaryTags: 'dietary_tags',
    },
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
    getNutritionInputs: vi.fn(),
  },
}))
vi.mock('../db/cook-sessions-repository.js', () => ({
  cookSessionsRepository: {
    create: vi.fn(),
    listByRecipe: vi.fn().mockResolvedValue([]),
    getStats: vi.fn(),
  },
}))

import { app } from '../index.js'
import { menuRepository } from '../db/menu-repository.js'
import { requests as rateLimitStore } from '../middleware/rateLimit.js'

beforeEach(() => {
  process.env['DEV_API_KEY'] = 'test-key'
  rateLimitStore.clear()
  mockSelect.mockReset()
  mockUpdate.mockReset()
  mockInsert.mockReset()
})

describe('GET /v1/menu/nutrition', () => {
  const portion = (date: string, calories: number, protein_g = 10) => ({
    date,
    mealCategory: 'Almuerzo',
    nutrition: { calories, protein_g, carbs_g: 40, fat_g: 5 },
  })
  const getInputs = vi.spyOn(menuRepository, 'getNutritionInputs')
  const fullTarget = {
    daily_calories: 2000,
    daily_protein_g: 50,
    daily_carbs_g: 200,
    daily_fat_g: 70,
  }

  it('returns 7 empty days plus the daily targets', async () => {
    getInputs.mockResolvedValueOnce({
      entries: [],
      target: { ...fullTarget, per_meal: { cena: { calories: 600 } } },
    })
    const res = await app.request('/v1/menu/nutrition?weekStart=2026-07-06', {
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(getInputs).toHaveBeenCalledWith('dev', '2026-07-06', '2026-07-12')
    expect(body.weekStart).toBe('2026-07-06')
    expect(body.days).toHaveLength(7)
    expect(body.days[6].date).toBe('2026-07-12')
    expect(body.days[0].calories).toBe(0)
    expect(body.targets).toEqual(fullTarget) // daily goals only
  })

  it('sums one portion per planned dish per day, like the day rollup', async () => {
    getInputs.mockResolvedValueOnce({
      entries: [
        portion('2026-07-06', 500, 30),
        portion('2026-07-06', 300.4, 10.04),
        portion('2026-07-08', 200),
        { date: '2026-07-07', mealCategory: 'Cena', nutrition: null },
      ],
      target: null,
    })
    const res = await app.request('/v1/menu/nutrition?weekStart=2026-07-06', {
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.days[0]).toMatchObject({ date: '2026-07-06', calories: 800, protein_g: 40 })
    expect(body.days[1].calories).toBe(0) // no nutrition data
    expect(body.days[2].calories).toBe(200)
    expect(body.targets).toBeNull()
  })
})

describe('PATCH /auth/profile with nutritionTargets', () => {
  it('stores nutritionTargets via profile update', async () => {
    mockInsert.mockReturnValue([])
    mockSelect.mockReturnValue([
      {
        userId: 'dev',
        preferredServings: 2,
        dietaryRestrictions: [],
        allergens: [],
        goals: [],
        timezone: null,
        nutritionTargets: {
          daily_calories: 1800,
          daily_protein_g: 60,
          daily_carbs_g: 200,
          daily_fat_g: 65,
        },
      },
    ])
    const res = await app.request('/auth/profile', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer test-key', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nutritionTargets: {
          daily_calories: 1800,
          daily_protein_g: 60,
          daily_carbs_g: 200,
          daily_fat_g: 65,
        },
      }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.nutritionTargets?.daily_calories).toBe(1800)
  })

  it('returns nutritionTargets in GET /auth/profile', async () => {
    mockSelect.mockReturnValue([
      {
        userId: 'dev',
        preferredServings: 2,
        dietaryRestrictions: [],
        allergens: [],
        goals: [],
        timezone: null,
        nutritionTargets: {
          daily_calories: 2000,
          daily_protein_g: 50,
          daily_carbs_g: 250,
          daily_fat_g: 70,
        },
      },
    ])
    const res = await app.request('/auth/profile', {
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.nutritionTargets?.daily_calories).toBe(2000)
  })
})
