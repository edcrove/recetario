import { describe, it, expect, vi, beforeEach } from 'vitest'

const { config } = vi.hoisted(() => ({
  config: {
    overview: vi.fn(),
    rename: vi.fn(),
    deleteFoodType: vi.fn(),
    deleteTag: vi.fn(),
    deleteCategory: vi.fn(),
    mergeTags: vi.fn(),
    create: vi.fn(),
    usedBy: vi.fn(),
  },
}))

// No database: the API-key lookup fails and DEV_API_KEY authenticates as 'dev'
vi.mock('../db/index.js', () => ({
  getDb: () => {
    throw new Error('no database in unit tests')
  },
  schema: new Proxy({}, { get: () => ({}) }),
}))
vi.mock('../db/config-repository.js', () => ({ configRepository: config }))

import { app } from '../index.js'
import { requests as rateLimitStore } from '../middleware/rateLimit.js'

const AUTH = { Authorization: 'Bearer test-key', 'Content-Type': 'application/json' }
const ID = '11111111-1111-4111-8111-111111111111'
const TARGET = '22222222-2222-4222-8222-222222222222'

beforeEach(() => {
  process.env['DEV_API_KEY'] = 'test-key'
  rateLimitStore.clear()
  vi.clearAllMocks()
})

describe('GET /v1/config/taxonomy', () => {
  it('returns the overview for the caller', async () => {
    const overview = {
      mealCategories: [
        { id: ID, name: 'Cena', slug: 'cena', usageCount: 0, isDeletable: false, isSystem: true },
      ],
      foodTypes: [],
      tags: [{ id: TARGET, name: 'rápido', slug: 'rapido', usageCount: 2, isDeletable: false }],
    }
    config.overview.mockResolvedValue(overview)
    const res = await app.request('/v1/config/taxonomy', { headers: AUTH })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(overview)
    expect(config.overview).toHaveBeenCalledWith('dev')
  })
})

describe('PATCH /v1/config/:type/:id', () => {
  it.each(['categories', 'food-types', 'tags'] as const)('renames a %s item', async (type) => {
    config.rename.mockResolvedValue({ id: ID, name: 'Nuevo' })
    const res = await app.request(`/v1/config/${type}/${ID}`, {
      method: 'PATCH',
      headers: AUTH,
      body: JSON.stringify({ name: 'Nuevo' }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: ID, name: 'Nuevo' })
    expect(config.rename).toHaveBeenCalledWith(type, 'dev', ID, 'Nuevo')
  })

  it("returns 404 when the item isn't the caller's", async () => {
    config.rename.mockResolvedValue(null)
    const res = await app.request(`/v1/config/tags/${ID}`, {
      method: 'PATCH',
      headers: AUTH,
      body: JSON.stringify({ name: 'X' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 400 for an unknown type', async () => {
    const res = await app.request(`/v1/config/colors/${ID}`, {
      method: 'PATCH',
      headers: AUTH,
      body: JSON.stringify({ name: 'X' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /v1/config/:type/:id', () => {
  it.each([
    ['food-types', 'deleteFoodType'],
    ['tags', 'deleteTag'],
    ['categories', 'deleteCategory'],
  ] as const)('deletes a %s item, passing reassignTo', async (type, method) => {
    config[method].mockResolvedValue('deleted')
    const res = await app.request(`/v1/config/${type}/${ID}?reassignTo=${TARGET}`, {
      method: 'DELETE',
      headers: AUTH,
    })
    expect(res.status).toBe(204)
    expect(config[method]).toHaveBeenCalledWith('dev', ID, TARGET)
  })

  it('deletes without reassignment', async () => {
    config.deleteTag.mockResolvedValue('deleted')
    const res = await app.request(`/v1/config/tags/${ID}`, { method: 'DELETE', headers: AUTH })
    expect(res.status).toBe(204)
    expect(config.deleteTag).toHaveBeenCalledWith('dev', ID, undefined)
  })

  it('returns 400 for a reassign target the caller cannot use', async () => {
    config.deleteFoodType.mockResolvedValue('bad_target')
    const res = await app.request(`/v1/config/food-types/${ID}?reassignTo=${TARGET}`, {
      method: 'DELETE',
      headers: AUTH,
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Invalid reassignTo')
  })

  it('returns 404 for a tag that is not the caller’s', async () => {
    config.deleteTag.mockResolvedValue('not_found')
    const res = await app.request(`/v1/config/tags/${ID}`, { method: 'DELETE', headers: AUTH })
    expect(res.status).toBe(404)
  })

  it.each([
    ['food-types', 'deleteFoodType', 'Not found or system type'],
    ['categories', 'deleteCategory', 'Not found or system category'],
  ] as const)('returns 400 for a system or foreign %s item', async (type, method, error) => {
    config[method].mockResolvedValue('not_found')
    const res = await app.request(`/v1/config/${type}/${ID}`, { method: 'DELETE', headers: AUTH })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe(error)
  })
})

describe('POST /v1/config/tags/merge', () => {
  it('merges source into target and reports how many recipes moved', async () => {
    config.mergeTags.mockResolvedValue(3)
    const res = await app.request('/v1/config/tags/merge', {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ sourceId: ID, targetId: TARGET }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ merged: 3 })
    expect(config.mergeTags).toHaveBeenCalledWith('dev', ID, TARGET)
  })

  it("returns 404 unless both tags are the caller's", async () => {
    config.mergeTags.mockResolvedValue(null)
    const res = await app.request('/v1/config/tags/merge', {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ sourceId: ID, targetId: TARGET }),
    })
    expect(res.status).toBe(404)
  })
})

// Story "App: pantalla Configurador con tabs y contadores": "Tap en badge abre
// lista de recetas que lo usan. Crear nuevo ítem en cada tab."
describe('POST /v1/config/:type', () => {
  const post = (type: string, body: unknown) =>
    app.request(`/v1/config/${type}`, { method: 'POST', headers: AUTH, body: JSON.stringify(body) })

  it.each(['categories', 'food-types', 'tags'] as const)(
    'creates a %s item for the caller (201)',
    async (type) => {
      const item = { id: ID, name: 'Brunch', slug: 'brunch', usageCount: 0, isDeletable: true }
      config.create.mockResolvedValue(item)
      const res = await post(type, { name: 'Brunch' })
      expect(res.status).toBe(201)
      expect(await res.json()).toEqual(item)
      expect(config.create).toHaveBeenCalledWith(type, 'dev', 'Brunch')
    },
  )

  it('a name that is already taken is a 409', async () => {
    config.create.mockResolvedValue('duplicate')
    const res = await post('categories', { name: 'Cena' })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'Already exists' })
  })

  it('a name with no usable characters is a 400', async () => {
    config.create.mockResolvedValue('invalid')
    const res = await post('tags', { name: '¡¡!!' })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid name' })
  })

  it('rejects an empty name and an unknown type (400) without touching the repository', async () => {
    expect((await post('tags', { name: '' })).status).toBe(400)
    expect((await post('ingredients', { name: 'x' })).status).toBe(400)
    expect(config.create).not.toHaveBeenCalled()
  })

  it('requires auth (401)', async () => {
    const res = await app.request('/v1/config/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'x' }),
    })
    expect(res.status).toBe(401)
  })
})

describe('GET /v1/config/:type/:id/recipes', () => {
  it.each(['categories', 'food-types', 'tags'] as const)(
    'lists the recipes behind a %s badge',
    async (type) => {
      const recipes = [{ id: TARGET, title: 'Milanesas' }]
      config.usedBy.mockResolvedValue(recipes)
      const res = await app.request(`/v1/config/${type}/${ID}/recipes`, { headers: AUTH })
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual(recipes)
      expect(config.usedBy).toHaveBeenCalledWith(type, 'dev', ID)
    },
  )

  it("someone else's (or a missing) item is a 404", async () => {
    config.usedBy.mockResolvedValue(null)
    const res = await app.request(`/v1/config/tags/${ID}/recipes`, { headers: AUTH })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Not found' })
  })

  it('an unused item lists nothing (200, empty)', async () => {
    config.usedBy.mockResolvedValue([])
    const res = await app.request(`/v1/config/categories/${ID}/recipes`, { headers: AUTH })
    expect(await res.json()).toEqual([])
  })

  it('rejects a non-uuid id (400) and requires auth (401)', async () => {
    expect((await app.request('/v1/config/tags/abc/recipes', { headers: AUTH })).status).toBe(400)
    expect((await app.request(`/v1/config/tags/${ID}/recipes`)).status).toBe(401)
  })
})
