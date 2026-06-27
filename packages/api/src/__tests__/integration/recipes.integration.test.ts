import { describe, it, expect, beforeAll } from 'vitest'

const skip = process.env['SKIP_INTEGRATION'] === 'true'
import app from '../../index.js'
import { resetDb } from '../../db/index.js'
import { TEST_API_KEY, TEST_OWNER_ID } from './globalSetup.js'

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
    expect(body.id).toBeTruthy()
    expect(body.title).toBe(baseRecipe.title)
    expect(body.ownerId).toBe(TEST_OWNER_ID)
    createdId = body.id
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

  it('GET /v1/recipes/search finds by title', async () => {
    const res = await app.request('/v1/recipes/search?q=Integration+Test+Pasta', {
      headers: { Authorization: authHeader },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.some((r: { id: string }) => r.id === createdId)).toBe(true)
  })

  it('PUT /v1/recipes/:id updates the recipe', async () => {
    const res = await app.request(`/v1/recipes/${createdId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ title: 'Updated Pasta', servings: 6 }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.title).toBe('Updated Pasta')
    expect(body.servings).toBe(6)
  })

  it('POST /v1/recipes with same source URL upserts (200)', async () => {
    const sourceUrl = 'https://example.com/recipes/test-pasta-dedupe'
    const withSource = { ...baseRecipe, title: 'Original', source: { url: sourceUrl } }

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
