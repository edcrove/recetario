import { describe, it, expect, beforeAll } from 'vitest'

const skip = process.env['SKIP_INTEGRATION'] === 'true'
import app from '../../index.js'
import { resetDb } from '../../db/index.js'
import { TEST_API_KEY } from './globalSetup.js'

const authHeader = `Bearer ${TEST_API_KEY}`

const baseRecipe = {
  title: 'Integration Test Pasta',
  servings: 4,
  category: 'Cena' as const,
  tags: ['test', 'integration'],
  ingredients: [
    { name: 'pasta', quantity: 200, unit: 'g' as const },
    { name: 'tomato sauce', quantity: 400, unit: 'g' as const },
  ],
  steps: [{ text: 'Boil pasta.' }, { text: 'Add sauce.' }],
  totalTimeMin: 20,
}

describe.skipIf(skip).sequential('Recipe integration tests', () => {
  let createdId: string

  beforeAll(() => {
    resetDb()
  })

  it('POST /v1/recipes creates a recipe (201)', async () => {
    const res = await app.request('/v1/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify(baseRecipe),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    createdId = body.id // set before assertions so subsequent tests can use it
    expect(body.id).toBeTruthy()
    expect(body.title).toBe(baseRecipe.title)
  })

  it('GET /v1/recipes/:id returns the recipe', async () => {
    const res = await app.request(`/v1/recipes/${createdId}`, {
      headers: { Authorization: authHeader },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(createdId)
    expect(body.ingredients).toHaveLength(2)
    expect(body.steps).toHaveLength(2)
  })

  it('GET /v1/recipes lists recipes', async () => {
    const res = await app.request('/v1/recipes', {
      headers: { Authorization: authHeader },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThanOrEqual(1)
  })

  it('GET /v1/recipes with large offset returns empty list', async () => {
    const res = await app.request('/v1/recipes?offset=10000', {
      headers: { Authorization: authHeader },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it('GET /v1/recipes/search finds by title', async () => {
    const res = await app.request('/v1/recipes/search?q=Integration+Test+Pasta', {
      headers: { Authorization: authHeader },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.some((r: { id: string }) => r.id === createdId)).toBe(true)
  })

  it('GET /v1/recipes/search returns empty for nonexistent query', async () => {
    const res = await app.request('/v1/recipes/search?q=zzzNonExistentRecipeXyz999', {
      headers: { Authorization: authHeader },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it('PUT /v1/recipes/:id updates the recipe', async () => {
    const res = await app.request(`/v1/recipes/${createdId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({
        title: 'Updated Pasta',
        servings: 6,
        notes: 'Great dish',
        yield: '4 servings',
        prepTimeMin: 5,
        cookTimeMin: 15,
      }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.title).toBe('Updated Pasta')
    expect(body.servings).toBe(6)
  })

  it('PUT /v1/recipes/:id returns 404 for non-existent recipe', async () => {
    const res = await app.request('/v1/recipes/00000000-0000-0000-0000-000000000000', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ title: 'Ghost' }),
    })
    expect(res.status).toBe(404)
  })

  it('POST /v1/recipes with all optional fields creates successfully', async () => {
    const fullRecipe = {
      ...baseRecipe,
      title: 'Full Optional Fields Recipe',
      prepTimeMin: 10,
      cookTimeMin: 30,
      notes: 'A detailed note',
      yield: '4 portions',
      ingredients: [
        {
          name: 'flour',
          quantity: 200,
          unit: 'g' as const,
          presentation: 'sifted',
          group: 'dry ingredients',
          note: 'use whole wheat',
        },
      ],
      steps: [{ text: 'Mix.', durationMin: 5, ovenTempC: 180 }],
    }
    const res = await app.request('/v1/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify(fullRecipe),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.notes).toBe('A detailed note')
    expect(body.yield).toBe('4 portions')
  })

  it('POST /v1/recipes with same source URL upserts (200)', async () => {
    const sourceUrl = 'https://example.com/recipes/test-pasta-dedupe'
    const withSource = {
      ...baseRecipe,
      title: 'Original',
      source: { type: 'url' as const, url: sourceUrl },
    }

    const res1 = await app.request('/v1/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify(withSource),
    })
    expect(res1.status).toBe(201)
    const id1 = (await res1.json()).id

    const res2 = await app.request('/v1/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ ...withSource, title: 'Updated via upsert' }),
    })
    expect(res2.status).toBe(200)
    const body2 = await res2.json()
    expect(body2.id).toBe(id1)
    expect(body2.title).toBe('Updated via upsert')
  })

  it('GET /v1/recipes/search finds by ingredient', async () => {
    const res = await app.request('/v1/recipes/search?ingredient=pasta', {
      headers: { Authorization: authHeader },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  it('GET /v1/recipes/search filters by category', async () => {
    const res = await app.request('/v1/recipes/search?category=Cena', {
      headers: { Authorization: authHeader },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  it('GET /v1/recipes/search filters by tag', async () => {
    const res = await app.request('/v1/recipes/search?tag=test', {
      headers: { Authorization: authHeader },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  it('POST /v1/recipes with externalId upserts (200)', async () => {
    const withExternal = {
      ...baseRecipe,
      title: 'MCP Original',
      source: { type: 'mcp' as const, externalId: 'mcp-tool-ext-123' },
    }

    const res1 = await app.request('/v1/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify(withExternal),
    })
    expect(res1.status).toBe(201)
    const id1 = (await res1.json()).id

    const res2 = await app.request('/v1/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ ...withExternal, title: 'MCP Updated' }),
    })
    expect(res2.status).toBe(200)
    const body2 = await res2.json()
    expect(body2.id).toBe(id1)
    expect(body2.title).toBe('MCP Updated')
  })

  it('GET /v1/recipes returns 401 for invalid API key', async () => {
    const res = await app.request('/v1/recipes', {
      headers: { Authorization: 'Bearer invalid-key-that-does-not-exist' },
    })
    expect(res.status).toBe(401)
  })

  it('DELETE /v1/recipes/:id removes the recipe', async () => {
    const res = await app.request(`/v1/recipes/${createdId}`, {
      method: 'DELETE',
      headers: { Authorization: authHeader },
    })
    expect(res.status).toBe(204)

    const getRes = await app.request(`/v1/recipes/${createdId}`, {
      headers: { Authorization: authHeader },
    })
    expect(getRes.status).toBe(404)
  })
})
