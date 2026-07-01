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
        onConflictDoUpdate: () => Promise.resolve(mockInsert()),
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
import { requests as rateLimitStore } from '../middleware/rateLimit.js'

beforeEach(() => {
  process.env['DEV_API_KEY'] = 'test-key'
  rateLimitStore.clear()
  mockSelect.mockReset()
  mockUpdate.mockReset()
  mockInsert.mockReset()
})

describe('GET /v1/menu/nutrition', () => {
  it('returns weekly nutrition totals (empty entries)', async () => {
    mockSelect
      .mockReturnValueOnce([]) // menu entries
      .mockReturnValueOnce([
        {
          nutritionTargets: {
            daily_calories: 2000,
            daily_protein_g: 50,
            daily_carbs_g: 200,
            daily_fat_g: 70,
          },
        },
      ])
    const res = await app.request('/v1/menu/nutrition?weekStart=2026-07-06', {
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.weekStart).toBe('2026-07-06')
    expect(body.days).toHaveLength(7)
    expect(body.days[0].calories).toBe(0)
    expect(body.targets?.daily_calories).toBe(2000)
  })

  it('aggregates nutrition from menu entries with scaling', async () => {
    mockSelect
      .mockReturnValueOnce([
        {
          date: '2026-07-06',
          servings: 4,
          recipeServings: 2,
          nutrition: { calories: 500, protein_g: 30, carbs_g: 60, fat_g: 20 },
        },
      ])
      .mockReturnValueOnce([{ nutritionTargets: null }])
    const res = await app.request('/v1/menu/nutrition?weekStart=2026-07-06', {
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    const monday = body.days.find((d: { date: string }) => d.date === '2026-07-06')
    expect(monday?.calories).toBe(1000) // 500 * (4/2)
    expect(body.targets).toBeNull()
  })

  it('handles zero recipeServings without dividing by zero', async () => {
    mockSelect
      .mockReturnValueOnce([
        {
          date: '2026-07-06',
          servings: 2,
          recipeServings: 0,
          nutrition: { calories: 500, protein_g: 20, carbs_g: 50, fat_g: 15 },
        },
      ])
      .mockReturnValueOnce([{ nutritionTargets: null }])
    const res = await app.request('/v1/menu/nutrition?weekStart=2026-07-06', {
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.days[0].calories).toBe(500) // scale = 1 when recipeServings = 0
  })

  it('skips entries with no nutrition data', async () => {
    mockSelect
      .mockReturnValueOnce([
        { date: '2026-07-06', servings: 2, recipeServings: 2, nutrition: null },
      ])
      .mockReturnValueOnce([{ nutritionTargets: null }])
    const res = await app.request('/v1/menu/nutrition?weekStart=2026-07-06', {
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.days[0].calories).toBe(0)
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
