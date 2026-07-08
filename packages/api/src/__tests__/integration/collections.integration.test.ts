import { describe, it, expect, beforeAll } from 'vitest'

const skip = process.env['SKIP_INTEGRATION'] === 'true'
import app from '../../index.js'
import { TEST_API_KEY, resetTestDb } from './globalSetup.js'

const auth = `Bearer ${TEST_API_KEY}`

const baseRecipe = {
  title: 'Tarta de la Colección',
  servings: 4,
  category: 'Cena' as const,
  ingredients: [{ name: 'masa', quantity: 1, unit: 'unit' as const }],
  steps: [{ text: 'Hornear' }],
}

// Regression coverage for the 2026-07-03 audit finding: collections/[id]
// had no screen at all — tapping a collection was a dead end. This exercises
// the backend endpoint that screen depends on.
describe.skipIf(skip).sequential('GET /v1/collections/:id/recipes', () => {
  let collectionId: string
  let recipeId: string

  beforeAll(async () => {
    await resetTestDb()

    const collectionRes = await app.request('/v1/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ name: 'Postres', emoji: '🍰' }),
    })
    collectionId = (await collectionRes.json()).id

    const recipeRes = await app.request('/v1/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify(baseRecipe),
    })
    recipeId = (await recipeRes.json()).id

    await app.request(`/v1/collections/${collectionId}/recipes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ recipeId }),
    })
  })

  it('returns the recipes belonging to the collection', async () => {
    const res = await app.request(`/v1/collections/${collectionId}/recipes`, {
      headers: { Authorization: auth },
    })
    expect(res.status).toBe(200)
    const recipes = (await res.json()) as Array<{ id: string; title: string }>
    expect(recipes.some((r) => r.id === recipeId && r.title === baseRecipe.title)).toBe(true)
  })

  it('no longer lists the recipe after it is removed from the collection', async () => {
    await app.request(`/v1/collections/${collectionId}/recipes/${recipeId}`, {
      method: 'DELETE',
      headers: { Authorization: auth },
    })
    const res = await app.request(`/v1/collections/${collectionId}/recipes`, {
      headers: { Authorization: auth },
    })
    const recipes = (await res.json()) as Array<{ id: string }>
    expect(recipes.some((r) => r.id === recipeId)).toBe(false)
  })

  it('returns 404 for a collection that does not exist', async () => {
    const res = await app.request('/v1/collections/00000000-0000-0000-0000-000000000000/recipes', {
      headers: { Authorization: auth },
    })
    expect(res.status).toBe(404)
  })
})
