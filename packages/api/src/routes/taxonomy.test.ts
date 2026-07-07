import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSelect, mockInsert, mockDelete } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockDelete: vi.fn(),
}))

vi.mock('../db/index.js', () => {
  const makeSelect = () => ({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(mockSelect()),
        where: () => Promise.resolve(mockSelect()),
        then: (resolve: (v: unknown) => void) => resolve(mockSelect()), // direct await
      }),
      orderBy: () => Promise.resolve(mockSelect()),
      leftJoin: () => ({
        where: () => ({
          groupBy: () => ({ orderBy: () => Promise.resolve(mockSelect()) }),
        }),
      }),
    }),
  })
  const makeInsert = () => ({
    values: () => ({
      returning: () => Promise.resolve(mockInsert()),
      onConflictDoNothing: () => Promise.resolve([]),
    }),
  })
  return {
    getDb: vi.fn(() => ({
      select: makeSelect,
      insert: () => makeInsert(),
      delete: () => ({ where: () => Promise.resolve([]) }),
    })),
    schema: {
      foodTypes: { name: 'name', id: 'id' },
      collections: { id: 'id', ownerId: 'owner_id', name: 'name' },
      recipeCollections: { collectionId: 'collection_id', recipeId: 'recipe_id' },
      recipeRelations: { fromId: 'from_id' },
    },
  }
})

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
import { recipeRepository } from '../db/repository.js'

const AUTH = { Authorization: 'Bearer test-key', 'Content-Type': 'application/json' }
const UUID = '550e8400-e29b-41d4-a716-446655440000'
const UUID2 = '550e8400-e29b-41d4-a716-446655440001'

beforeEach(() => {
  process.env['DEV_API_KEY'] = 'test-key'
  rateLimitStore.clear()
  mockSelect.mockReset()
  mockInsert.mockReset()
  mockDelete.mockReset()
})

describe('GET /v1/food-types', () => {
  it('returns list of food types', async () => {
    mockSelect.mockReturnValue([{ id: UUID, name: 'Guiso', slug: 'guiso', isSystem: 1 }])
    const res = await app.request('/v1/food-types', {
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body[0].name).toBe('Guiso')
    expect(body[0].isSystem).toBe(true)
  })
})

describe('POST /v1/food-types', () => {
  it('creates a user-defined food type', async () => {
    mockInsert.mockReturnValue([{ id: UUID, name: 'Sushi', slug: 'sushi', isSystem: 0 }])
    const res = await app.request('/v1/food-types', {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ name: 'Sushi' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('Sushi')
    expect(body.isSystem).toBe(false)
  })
})

describe('GET /v1/collections', () => {
  it('returns collections with recipe count', async () => {
    mockSelect.mockReturnValue([
      {
        id: UUID,
        name: 'Favoritas',
        emoji: '⭐',
        description: null,
        recipeCount: 3,
        createdAt: new Date(),
      },
    ])
    const res = await app.request('/v1/collections', {
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body[0].recipeCount).toBe(3)
  })
})

describe('POST /v1/collections', () => {
  it('creates a new collection with emoji', async () => {
    mockInsert.mockReturnValue([
      { id: UUID, name: 'Verano', emoji: '🌞', description: null, createdAt: new Date() },
    ])
    const res = await app.request('/v1/collections', {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ name: 'Verano', emoji: '🌞' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('Verano')
    expect(body.emoji).toBe('🌞')
    expect(body.recipeCount).toBe(0)
  })

  it('creates a collection without emoji (emoji is null)', async () => {
    mockInsert.mockReturnValue([
      { id: UUID, name: 'Sin emoji', emoji: null, description: null, createdAt: new Date() },
    ])
    const res = await app.request('/v1/collections', {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ name: 'Sin emoji' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.emoji).toBeNull()
    expect(body.description).toBeNull()
  })
})

describe('POST /v1/collections/:id/recipes', () => {
  it('adds a recipe to a collection', async () => {
    mockSelect.mockReturnValue([{ id: UUID, name: 'Favoritas', ownerId: 'dev' }])
    const res = await app.request(`/v1/collections/${UUID}/recipes`, {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ recipeId: UUID2 }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.collectionId).toBe(UUID)
    expect(body.recipeId).toBe(UUID2)
  })

  it('returns 404 when collection not found', async () => {
    mockSelect.mockReturnValue([])
    const res = await app.request(`/v1/collections/${UUID}/recipes`, {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ recipeId: UUID2 }),
    })
    expect(res.status).toBe(404)
  })
})

describe('POST /v1/recipes/:id/relations', () => {
  it('creates a recipe relation', async () => {
    const res = await app.request(`/v1/recipes/${UUID}/relations`, {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ toId: UUID2, relationType: 'similar' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.fromId).toBe(UUID)
    expect(body.relationType).toBe('similar')
  })

  it('rejects invalid relationType', async () => {
    const res = await app.request(`/v1/recipes/${UUID}/relations`, {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ toId: UUID2, relationType: 'enemy' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('GET /v1/collections/:id/recipes', () => {
  it('returns the recipes in a collection', async () => {
    mockSelect
      .mockReturnValueOnce([{ id: UUID, name: 'Favoritas', ownerId: 'dev' }]) // ownership check
      .mockReturnValueOnce([{ recipeId: UUID2 }]) // recipe-collection links
    vi.mocked(recipeRepository.findById).mockResolvedValueOnce({
      id: UUID2,
      title: 'Tarta',
    } as never)
    const res = await app.request(`/v1/collections/${UUID}/recipes`, {
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].title).toBe('Tarta')
  })

  it('skips recipes that no longer exist (deleted since being added)', async () => {
    mockSelect
      .mockReturnValueOnce([{ id: UUID, name: 'Favoritas', ownerId: 'dev' }])
      .mockReturnValueOnce([{ recipeId: UUID2 }])
    vi.mocked(recipeRepository.findById).mockResolvedValueOnce(null)
    const res = await app.request(`/v1/collections/${UUID}/recipes`, {
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it('returns 404 when collection not found', async () => {
    mockSelect.mockReturnValueOnce([])
    const res = await app.request(`/v1/collections/${UUID}/recipes`, {
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /v1/collections/:id/recipes/:recipeId', () => {
  it('removes a recipe from a collection and returns 204', async () => {
    mockSelect.mockReturnValue([{ id: UUID, name: 'Favoritas', ownerId: 'dev' }])
    const res = await app.request(`/v1/collections/${UUID}/recipes/${UUID2}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(204)
  })

  it('returns 404 when collection not found', async () => {
    mockSelect.mockReturnValue([])
    const res = await app.request(`/v1/collections/${UUID}/recipes/${UUID2}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(404)
  })
})

describe('GET /v1/recipes/:id/relations', () => {
  it('returns relations for a recipe', async () => {
    mockSelect.mockReturnValue([
      { fromId: UUID, toId: UUID2, relationType: 'variation', createdBy: 'agent' },
    ])
    const res = await app.request(`/v1/recipes/${UUID}/relations`, {
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body[0].relationType).toBe('variation')
  })
})
