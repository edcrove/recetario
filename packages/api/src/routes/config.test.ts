import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSelect, mockUpdate, mockDelete, mockInsert } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockInsert: vi.fn(),
}))

vi.mock('../db/index.js', () => ({
  getDb: vi.fn(() => ({
    select: () => ({
      from: () => ({
        leftJoin: () => ({ groupBy: () => ({ orderBy: () => Promise.resolve(mockSelect()) }) }),
        where: () => ({
          limit: () => Promise.resolve(mockSelect()),
          // direct await on the query (for count queries)
          then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
            try {
              resolve(mockSelect())
            } catch (e) {
              reject(e)
            }
          },
        }),
        orderBy: () => Promise.resolve(mockSelect()),
      }),
    }),
    update: () => ({
      set: () => ({ where: () => ({ returning: () => Promise.resolve(mockUpdate()) }) }),
      // for update().where() without returning
      where: () => Promise.resolve(mockUpdate()),
    }),
    delete: () => ({
      where: () => ({
        returning: () => Promise.resolve(mockDelete()),
        then: (r: (v: unknown[]) => void) => r(mockDelete()),
      }),
    }),
    insert: () => ({ values: () => ({ onConflictDoNothing: () => Promise.resolve([]) }) }),
  })),
  schema: {
    mealCategories: { id: 'id', name: 'name', slug: 'slug', isSystem: 'is_system' },
    foodTypes: { id: 'id', name: 'name', slug: 'slug', isSystem: 'is_system' },
    tags: { id: 'id', name: 'name', slug: 'slug' },
    recipes: { id: 'id', category: 'category' },
    recipeFoodTypes: { foodTypeId: 'food_type_id', recipeId: 'recipe_id' },
    recipeTags: { tagId: 'tag_id', recipeId: 'recipe_id' },
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

const AUTH = { Authorization: 'Bearer test-key', 'Content-Type': 'application/json' }
const UUID = '550e8400-e29b-41d4-a716-446655440000'
const UUID2 = '550e8400-e29b-41d4-a716-446655440001'

beforeEach(() => {
  process.env['DEV_API_KEY'] = 'test-key'
  rateLimitStore.clear()
  mockSelect.mockReset()
  mockUpdate.mockReset()
  mockDelete.mockReset()
  mockInsert.mockReset()
})

describe('GET /v1/config/taxonomy', () => {
  it('returns taxonomy overview — system items with 0 usage are not deletable', async () => {
    mockSelect
      .mockReturnValueOnce([
        { id: UUID, name: 'Desayuno', slug: 'desayuno', isSystem: 1, usageCount: 0 },
      ])
      .mockReturnValueOnce([{ id: UUID, name: 'Guiso', slug: 'guiso', isSystem: 1, usageCount: 0 }])
      .mockReturnValueOnce([{ id: UUID2, name: 'vegano', slug: 'vegano', usageCount: 0 }])
    const res = await app.request('/v1/config/taxonomy', {
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    // System items with 0 usage are NOT deletable
    expect(body.mealCategories[0].isDeletable).toBe(false)
    expect(body.mealCategories[0].isSystem).toBe(true)
    expect(body.foodTypes[0].isDeletable).toBe(false)
    // Tags are not system so 0 usage = deletable
    expect(body.tags[0].isDeletable).toBe(true)
  })

  it('non-system items with usage > 0 are not deletable', async () => {
    mockSelect
      .mockReturnValueOnce([
        { id: UUID, name: 'Desayuno', slug: 'desayuno', isSystem: 1, usageCount: 3 },
      ])
      .mockReturnValueOnce([{ id: UUID, name: 'Guiso', slug: 'guiso', isSystem: 1, usageCount: 5 }])
      .mockReturnValueOnce([{ id: UUID2, name: 'vegano', slug: 'vegano', usageCount: 0 }])
    const res = await app.request('/v1/config/taxonomy', {
      headers: { Authorization: 'Bearer test-key' },
    })
    const body = await res.json()
    expect(body.mealCategories[0].isDeletable).toBe(false)
    expect(body.tags[0].isDeletable).toBe(true)
  })
})

describe('PATCH /v1/config/:type/:id', () => {
  it('renames a meal category', async () => {
    mockUpdate.mockReturnValue([{ id: UUID, name: 'Brunch', slug: 'brunch' }])
    const res = await app.request(`/v1/config/categories/${UUID}`, {
      method: 'PATCH',
      headers: AUTH,
      body: JSON.stringify({ name: 'Brunch' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('Brunch')
  })

  it('renames a food type', async () => {
    mockUpdate.mockReturnValue([{ id: UUID, name: 'Estofado', slug: 'estofado' }])
    const res = await app.request(`/v1/config/food-types/${UUID}`, {
      method: 'PATCH',
      headers: AUTH,
      body: JSON.stringify({ name: 'Estofado' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('Estofado')
  })

  it('renames a tag', async () => {
    mockUpdate.mockReturnValue([{ id: UUID, name: 'vegetariano', slug: 'vegetariano' }])
    const res = await app.request(`/v1/config/tags/${UUID}`, {
      method: 'PATCH',
      headers: AUTH,
      body: JSON.stringify({ name: 'vegetariano' }),
    })
    expect(res.status).toBe(200)
  })

  it('returns 404 when category not found', async () => {
    mockUpdate.mockReturnValue([])
    const res = await app.request(`/v1/config/categories/${UUID}`, {
      method: 'PATCH',
      headers: AUTH,
      body: JSON.stringify({ name: 'X' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 404 when food-type not found', async () => {
    mockUpdate.mockReturnValue([])
    const res = await app.request(`/v1/config/food-types/${UUID}`, {
      method: 'PATCH',
      headers: AUTH,
      body: JSON.stringify({ name: 'X' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 404 when tag not found', async () => {
    mockUpdate.mockReturnValue([])
    const res = await app.request(`/v1/config/tags/${UUID}`, {
      method: 'PATCH',
      headers: AUTH,
      body: JSON.stringify({ name: 'X' }),
    })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /v1/config/:type/:id', () => {
  it('deletes a food type with 0 usage', async () => {
    mockSelect.mockReturnValue([{ count: 0 }])
    mockDelete.mockReturnValue([{ id: UUID }])
    const res = await app.request(`/v1/config/food-types/${UUID}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(204)
  })

  it('reassigns recipes before deleting food type', async () => {
    mockSelect.mockReturnValue([{ count: 3 }])
    mockDelete.mockReturnValue([{ id: UUID }])
    const res = await app.request(`/v1/config/food-types/${UUID}?reassignTo=${UUID2}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(204)
  })

  it('deletes a tag with reassignment', async () => {
    mockDelete.mockReturnValue([])
    const res = await app.request(`/v1/config/tags/${UUID}?reassignTo=${UUID2}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(204)
  })

  it('deletes food type recipes without reassignment when in use', async () => {
    mockSelect.mockReturnValue([{ count: 2 }])
    mockDelete.mockReturnValue([{ id: UUID }])
    const res = await app.request(`/v1/config/food-types/${UUID}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(204)
  })

  it('returns 400 when trying to delete a system food type', async () => {
    mockSelect.mockReturnValue([{ count: 0 }])
    mockDelete.mockReturnValue([]) // no rows deleted (system type blocked by ne condition)
    const res = await app.request(`/v1/config/food-types/${UUID}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(400)
  })

  it('deletes a tag without reassignment', async () => {
    mockDelete.mockReturnValue([])
    const res = await app.request(`/v1/config/tags/${UUID}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(204)
  })
})

describe('POST /v1/config/tags/merge', () => {
  it('merges source tag into target', async () => {
    mockSelect.mockReturnValue([{ recipeId: UUID2, tagId: UUID }])
    mockDelete.mockReturnValue([])
    const res = await app.request('/v1/config/tags/merge', {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ sourceId: UUID, targetId: UUID2 }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.merged).toBe(1)
  })
})
