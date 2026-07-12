import { describe, it, expect, beforeAll } from 'vitest'

const skip = process.env['SKIP_INTEGRATION'] === 'true'
import app from '../../index.js'
import { TEST_API_KEY, resetTestDb } from './globalSetup.js'

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

  beforeAll(async () => {
    await resetTestDb()
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

// Regression suite for the 2026-07-03 audit finding: foodTypeIds were collected
// by the app's FoodTypePicker UI but never actually persisted anywhere —
// recipe_food_types existed in the schema but nothing ever inserted into it.
describe.skipIf(skip).sequential('Recipe foodTypeIds', () => {
  let foodTypeA: string
  let foodTypeB: string
  let recipeId: string

  beforeAll(async () => {
    const res = await app.request('/v1/food-types', { headers: { Authorization: authHeader } })
    const foodTypes = (await res.json()) as Array<{ id: string; slug: string }>
    foodTypeA = foodTypes.find((f) => f.slug === 'guiso')!.id
    foodTypeB = foodTypes.find((f) => f.slug === 'sopa')!.id
  })

  it('POST /v1/recipes with foodTypeIds persists and returns them', async () => {
    const res = await app.request('/v1/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ ...baseRecipe, title: 'Con tipos', foodTypeIds: [foodTypeA] }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    recipeId = body.id
    expect(body.foodTypeIds).toEqual([foodTypeA])
  })

  it('GET /v1/recipes/:id returns the persisted foodTypeIds', async () => {
    const res = await app.request(`/v1/recipes/${recipeId}`, {
      headers: { Authorization: authHeader },
    })
    const body = await res.json()
    expect(body.foodTypeIds).toEqual([foodTypeA])
  })

  it('GET /v1/recipes includes foodTypeIds for listed recipes', async () => {
    const res = await app.request('/v1/recipes?limit=100', {
      headers: { Authorization: authHeader },
    })
    const body = (await res.json()) as Array<{ id: string; foodTypeIds: string[] }>
    const found = body.find((r) => r.id === recipeId)
    expect(found?.foodTypeIds).toEqual([foodTypeA])
  })

  it('PUT /v1/recipes/:id replaces foodTypeIds', async () => {
    const res = await app.request(`/v1/recipes/${recipeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ ...baseRecipe, title: 'Con tipos', foodTypeIds: [foodTypeB] }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.foodTypeIds).toEqual([foodTypeB])
  })

  it('PUT /v1/recipes/:id with an empty foodTypeIds array clears them', async () => {
    const res = await app.request(`/v1/recipes/${recipeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ ...baseRecipe, title: 'Con tipos', foodTypeIds: [] }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.foodTypeIds).toEqual([])
  })

  it('POST /v1/recipes without foodTypeIds defaults to an empty array', async () => {
    const res = await app.request('/v1/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ ...baseRecipe, title: 'Sin tipos' }),
    })
    const body = await res.json()
    expect(body.foodTypeIds).toEqual([])
  })
})

// Story: recipe visibility + fork schema (sharing epic, story 1).
// Covers: DB default 'private', owner publish/unpublish via PUT, non-owner 404,
// and forked_from_id's ON DELETE SET NULL behavior.
describe.skipIf(skip).sequential('Recipe visibility and fork provenance', () => {
  const OTHER_API_KEY = 'test-api-key-owner-b'
  const otherAuthHeader = `Bearer ${OTHER_API_KEY}`
  let recipeId: string

  beforeAll(async () => {
    await resetTestDb()
    const { getDb, schema } = await import('../../db/index.js')
    // Same precomputed sha256('test-api-key-owner-b') used by the IDOR suite —
    // avoids a live createHash() call over a fixed test constant (CodeQL flags
    // that shape as a possible weak password hash).
    const hash = 'bfad6973f42900a475880450bde62aef4757c889dc8de552d2507de5d334ad74'
    await getDb()
      .insert(schema.apiKeys)
      .values({ keyHash: hash, ownerId: 'test-owner-b', label: 'owner-b' })
      .onConflictDoNothing()

    const res = await app.request('/v1/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ ...baseRecipe, title: 'Receta Visibilidad' }),
    })
    expect(res.status).toBe(201)
    recipeId = (await res.json()).id
  })

  it('a created recipe defaults to visibility private', async () => {
    const res = await app.request(`/v1/recipes/${recipeId}`, {
      headers: { Authorization: authHeader },
    })
    const body = await res.json()
    expect(body.visibility).toBe('private')
    expect(body.forkedFromId).toBeNull()
  })

  it('the owner can publish via PUT and it persists', async () => {
    const putRes = await app.request(`/v1/recipes/${recipeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ visibility: 'public' }),
    })
    expect(putRes.status).toBe(200)
    expect((await putRes.json()).visibility).toBe('public')

    const getRes = await app.request(`/v1/recipes/${recipeId}`, {
      headers: { Authorization: authHeader },
    })
    expect((await getRes.json()).visibility).toBe('public')
  })

  it("a non-owner's PUT to change visibility returns 404", async () => {
    const res = await app.request(`/v1/recipes/${recipeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: otherAuthHeader },
      body: JSON.stringify({ visibility: 'private' }),
    })
    expect(res.status).toBe(404)
    // and the recipe is untouched
    const getRes = await app.request(`/v1/recipes/${recipeId}`, {
      headers: { Authorization: authHeader },
    })
    expect((await getRes.json()).visibility).toBe('public')
  })

  it('a POST can create a public recipe directly', async () => {
    const res = await app.request('/v1/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ ...baseRecipe, title: 'Nace Pública', visibility: 'public' }),
    })
    expect(res.status).toBe(201)
    expect((await res.json()).visibility).toBe('public')
  })

  it('clients cannot set forkedFromId on create (schema strips it)', async () => {
    const res = await app.request('/v1/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ ...baseRecipe, title: 'Sin Fork', forkedFromId: recipeId }),
    })
    expect(res.status).toBe(201)
    expect((await res.json()).forkedFromId).toBeNull()
  })

  it('deleting the original sets forkedFromId to null on the fork (SET NULL)', async () => {
    const { getDb, schema } = await import('../../db/index.js')
    const db = getDb()
    const { eq } = await import('drizzle-orm')

    // Insert the fork directly at the DB layer: the copy endpoint (story 3)
    // does not exist yet, and the API deliberately strips forkedFromId.
    const [fork] = (await db
      .insert(schema.recipes)
      .values({
        ownerId: 'test-owner',
        title: 'Fork De Receta',
        servings: 2,
        category: 'Cena',
        forkedFromId: recipeId,
      })
      .returning()) as { id: string; forkedFromId: string | null }[]
    expect(fork?.forkedFromId).toBe(recipeId)

    const delRes = await app.request(`/v1/recipes/${recipeId}`, {
      method: 'DELETE',
      headers: { Authorization: authHeader },
    })
    expect(delRes.status).toBe(204)

    const [after] = await db
      .select({ forkedFromId: schema.recipes.forkedFromId })
      .from(schema.recipes)
      .where(eq(schema.recipes.id, fork!.id))
    expect(after?.forkedFromId).toBeNull()
  })

  it('round-trips difficulty and filters the list by maxTotalTime and difficulty', async () => {
    const json = (title: string, body: object) =>
      app.request('/v1/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({
          title,
          servings: 2,
          category: 'Cena',
          ingredients: [{ name: 'x', quantity: 1, unit: 'unit' }],
          steps: [{ text: 'Cocinar.' }],
          ...body,
        }),
      })

    const quick = (await (
      await json('Rápida fácil', { totalTimeMin: 15, difficulty: 'fácil' })
    ).json()) as { id: string; difficulty: string }
    const slow = (await (
      await json('Lenta difícil', { totalTimeMin: 90, difficulty: 'difícil' })
    ).json()) as { id: string }
    // difficulty is persisted and returned.
    expect(quick.difficulty).toBe('fácil')
    const got = (await (
      await app.request(`/v1/recipes/${quick.id}`, { headers: { Authorization: authHeader } })
    ).json()) as { difficulty: string }
    expect(got.difficulty).toBe('fácil')

    // maxTotalTime=30 excludes the 90-min recipe.
    const byTime = (await (
      await app.request('/v1/recipes?limit=100&maxTotalTime=30', {
        headers: { Authorization: authHeader },
      })
    ).json()) as { id: string }[]
    expect(byTime.some((r) => r.id === quick.id)).toBe(true)
    expect(byTime.some((r) => r.id === slow.id)).toBe(false)

    // difficulty filter.
    const byDiff = (await (
      await app.request('/v1/recipes?limit=100&difficulty=dif%C3%ADcil', {
        headers: { Authorization: authHeader },
      })
    ).json()) as { id: string }[]
    expect(byDiff.some((r) => r.id === slow.id)).toBe(true)
    expect(byDiff.some((r) => r.id === quick.id)).toBe(false)
  })
})
