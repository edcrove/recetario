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

// Order 1 bug (product decision: collections respect household visibility) +
// the IDOR that surfaced alongside it. Recipes are household-shared, so a
// housemate's recipe added to a collection must render for the owner; and a
// recipe the caller cannot read must not be linkable into a collection.
describe.skipIf(skip).sequential('Collections + household visibility / IDOR', () => {
  async function register(email: string): Promise<{ token: string; userId: string }> {
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' }),
    })
    const body = (await res.json()) as { token: string; user: { id: string } }
    return { token: body.token, userId: body.user.id }
  }
  const bearer = (token: string) => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  })
  async function createRecipe(token: string, title: string): Promise<string> {
    const res = await app.request('/v1/recipes', {
      method: 'POST',
      headers: bearer(token),
      body: JSON.stringify({ ...baseRecipe, title }),
    })
    expect(res.status).toBe(201)
    return ((await res.json()) as { id: string }).id
  }

  let owner: { token: string; userId: string }
  let mateRecipeId: string
  let outsiderRecipeId: string
  let collectionId: string

  beforeAll(async () => {
    await resetTestDb()
    const stamp = Date.now()
    owner = await register(`col-owner-${stamp}@example.com`)
    const mate = await register(`col-mate-${stamp}@example.com`)
    const outsider = await register(`col-out-${stamp}@example.com`)

    const hhRes = await app.request('/v1/households', {
      method: 'POST',
      headers: bearer(owner.token),
      body: JSON.stringify({ name: 'Casa Colección' }),
    })
    const householdId = ((await hhRes.json()) as { id: string }).id
    const invite = await app.request(`/v1/households/${householdId}/invite`, {
      method: 'POST',
      headers: bearer(owner.token),
      body: JSON.stringify({ userId: mate.userId, role: 'member' }),
    })
    expect(invite.status).toBe(201)

    mateRecipeId = await createRecipe(mate.token, 'Receta del Compa')
    outsiderRecipeId = await createRecipe(outsider.token, 'Receta Ajena')

    const colRes = await app.request('/v1/collections', {
      method: 'POST',
      headers: bearer(owner.token),
      body: JSON.stringify({ name: 'Compartida', emoji: '🏠' }),
    })
    collectionId = ((await colRes.json()) as { id: string }).id
  })

  it("lists a household-mate's recipe added to the owner's collection", async () => {
    const add = await app.request(`/v1/collections/${collectionId}/recipes`, {
      method: 'POST',
      headers: bearer(owner.token),
      body: JSON.stringify({ recipeId: mateRecipeId }),
    })
    expect(add.status).toBe(201)

    const res = await app.request(`/v1/collections/${collectionId}/recipes`, {
      headers: bearer(owner.token),
    })
    expect(res.status).toBe(200)
    const recipes = (await res.json()) as Array<{ id: string }>
    expect(recipes.some((r) => r.id === mateRecipeId)).toBe(true)
  })

  it('rejects adding a recipe the caller cannot read (IDOR) and never links it', async () => {
    const add = await app.request(`/v1/collections/${collectionId}/recipes`, {
      method: 'POST',
      headers: bearer(owner.token),
      body: JSON.stringify({ recipeId: outsiderRecipeId }),
    })
    expect(add.status).toBe(404)

    const res = await app.request(`/v1/collections/${collectionId}/recipes`, {
      headers: bearer(owner.token),
    })
    const recipes = (await res.json()) as Array<{ id: string }>
    expect(recipes.some((r) => r.id === outsiderRecipeId)).toBe(false)
  })
})
