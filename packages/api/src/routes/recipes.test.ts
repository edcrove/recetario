import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import type { Recipe } from '@recetario/shared'

// Mock the repository module before importing the app
vi.mock('../db/repository.js', () => {
  const mockRepo = {
    upsert: vi.fn(),
    findById: vi.fn(),
    list: vi.fn(),
    search: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(),
  }
  return {
    recipeRepository: mockRepo,
    RecipeRepository: vi.fn(() => mockRepo),
  }
})

// Mock the DB module to prevent connection attempts in auth middleware
vi.mock('../db/index.js', () => ({
  getDb: vi.fn(() => {
    throw new Error('DB not available in tests')
  }),
  schema: {},
}))

import { app } from '../index.js'
import { recipeRepository } from '../db/repository.js'
import { requests as rateLimitStore } from '../middleware/rateLimit.js'

const mockRepo = recipeRepository as unknown as {
  upsert: ReturnType<typeof vi.fn>
  findById: ReturnType<typeof vi.fn>
  list: ReturnType<typeof vi.fn>
  search: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
}

const DEV_KEY = 'recipes-test-key'
const AUTH_HEADERS = { Authorization: `Bearer ${DEV_KEY}` }

const sampleRecipe: Recipe = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  title: 'Tortilla española',
  servings: 4,
  category: 'Almuerzo',
  tags: ['española'],
  images: [],
  originalLanguage: 'es',
  translations: [],
  ingredients: [{ name: 'Huevos', quantity: 6, unit: 'unit' }],
  steps: [{ text: 'Batir los huevos' }],
  source: { type: 'manual' },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const validCreateBody = {
  title: 'Tortilla española',
  servings: 4,
  category: 'Almuerzo',
  tags: ['española'],
  ingredients: [{ name: 'Huevos', quantity: 6, unit: 'unit' }],
  steps: [{ text: 'Batir los huevos' }],
}

beforeAll(() => {
  process.env['DEV_API_KEY'] = DEV_KEY
})

afterAll(() => {
  delete process.env['DEV_API_KEY']
})

beforeEach(() => {
  vi.clearAllMocks()
  rateLimitStore.clear()
})

describe('POST /v1/recipes', () => {
  it('returns 201 with valid body (new recipe)', async () => {
    mockRepo.upsert.mockResolvedValue({ recipe: sampleRecipe, created: true })

    const res = await app.request('/v1/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS },
      body: JSON.stringify(validCreateBody),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.title).toBe('Tortilla española')
  })

  it('returns 400 on invalid body (missing title)', async () => {
    const res = await app.request('/v1/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS },
      body: JSON.stringify({ servings: 4 }),
    })

    expect(res.status).toBe(400)
  })

  it('returns 200 when same source URL is used again (upsert)', async () => {
    mockRepo.upsert.mockResolvedValue({ recipe: sampleRecipe, created: false })

    const res = await app.request('/v1/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS },
      body: JSON.stringify({
        ...validCreateBody,
        source: { type: 'url', url: 'https://example.com/recipe' },
      }),
    })

    expect(res.status).toBe(200)
  })

  it('returns 201 when new source is provided', async () => {
    mockRepo.upsert.mockResolvedValue({ recipe: sampleRecipe, created: true })

    const res = await app.request('/v1/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS },
      body: JSON.stringify({
        ...validCreateBody,
        source: { type: 'url', url: 'https://newrecipe.com/1' },
      }),
    })

    expect(res.status).toBe(201)
  })
})

describe('GET /v1/recipes/:id', () => {
  it('returns 404 when recipe not found', async () => {
    mockRepo.findById.mockResolvedValue(null)

    const res = await app.request('/v1/recipes/550e8400-e29b-41d4-a716-446655440000', {
      headers: AUTH_HEADERS,
    })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Recipe not found')
  })

  it('returns 200 with recipe when found', async () => {
    mockRepo.findById.mockResolvedValue(sampleRecipe)

    const res = await app.request('/v1/recipes/550e8400-e29b-41d4-a716-446655440000', {
      headers: AUTH_HEADERS,
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.title).toBe('Tortilla española')
  })
})

describe('GET /v1/recipes', () => {
  it('returns 200 with array', async () => {
    mockRepo.list.mockResolvedValue([sampleRecipe])

    const res = await app.request('/v1/recipes', { headers: AUTH_HEADERS })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(1)
  })
})

describe('GET /v1/recipes/search', () => {
  it('returns 200 with search results', async () => {
    mockRepo.search.mockResolvedValue([sampleRecipe])

    const res = await app.request('/v1/recipes/search?q=tortilla', { headers: AUTH_HEADERS })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })
})

describe('PUT /v1/recipes/:id', () => {
  it('returns 200 with updated recipe', async () => {
    mockRepo.findById.mockResolvedValue(sampleRecipe)
    mockRepo.update.mockResolvedValue({ ...sampleRecipe, title: 'Updated', servings: 6 })

    const res = await app.request('/v1/recipes/550e8400-e29b-41d4-a716-446655440000', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS },
      body: JSON.stringify({ title: 'Updated', servings: 6 }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.title).toBe('Updated')
    expect(body.servings).toBe(6)
  })

  it('returns 404 when recipe not found', async () => {
    mockRepo.findById.mockResolvedValue(null)
    mockRepo.update.mockResolvedValue(null)

    const res = await app.request('/v1/recipes/550e8400-e29b-41d4-a716-446655440000', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS },
      body: JSON.stringify({ title: 'Updated' }),
    })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Recipe not found')
  })
})

describe('DELETE /v1/recipes/:id', () => {
  it('returns 204 when deleted', async () => {
    mockRepo.delete.mockResolvedValue(true)

    const res = await app.request('/v1/recipes/550e8400-e29b-41d4-a716-446655440000', {
      method: 'DELETE',
      headers: AUTH_HEADERS,
    })
    expect(res.status).toBe(204)
  })

  it('returns 404 when not found', async () => {
    mockRepo.delete.mockResolvedValue(false)

    const res = await app.request('/v1/recipes/550e8400-e29b-41d4-a716-446655440000', {
      method: 'DELETE',
      headers: AUTH_HEADERS,
    })
    expect(res.status).toBe(404)
  })
})
