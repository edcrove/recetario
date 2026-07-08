import { describe, it, expect, beforeAll } from 'vitest'

const skip = process.env['SKIP_INTEGRATION'] === 'true'
import app from '../../index.js'
import { getDb, schema } from '../../db/index.js'
import { TEST_API_KEY, resetTestDb } from './globalSetup.js'

const authHeader = `Bearer ${TEST_API_KEY}`
const OTHER_OWNER_ID = 'test-owner-b'
const OTHER_API_KEY = 'test-api-key-owner-b'
const otherAuthHeader = `Bearer ${OTHER_API_KEY}`

const baseRecipe = {
  title: 'Receta de Otro Usuario',
  servings: 2,
  category: 'Cena' as const,
  ingredients: [{ name: 'sal', quantity: null, unit: null }],
  steps: [{ text: 'Cocinar' }],
}

// Regression suite for two P0 IDOR findings: GET /v1/food-types returned every
// user's custom food types unfiltered, and POST/GET /v1/recipes/:id/relations
// had no ownership check at all on the path recipe id. These tests exercise the
// fix against a real Postgres instance (not mocks) with two genuinely distinct
// owners.
describe.skipIf(skip).sequential('Taxonomy/relations cross-tenant authorization', () => {
  let ownFoodTypeId: string
  let otherFoodTypeId: string
  let otherRecipeId: string

  beforeAll(async () => {
    await resetTestDb()
    const db = getDb()
    // Precomputed sha256('test-api-key-owner-b') — same constant/hash used by
    // config.integration.test.ts, avoids a fresh createHash() call over a fixed
    // test constant (CodeQL flags that shape as a possible weak password hash).
    const hash = 'bfad6973f42900a475880450bde62aef4757c889dc8de552d2507de5d334ad74'
    await db
      .insert(schema.apiKeys)
      .values({ keyHash: hash, ownerId: OTHER_OWNER_ID, label: 'owner-b' })
      .onConflictDoNothing()

    const createRes = await app.request('/v1/food-types', {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Mi Tipo IDOR Test' }),
    })
    expect(createRes.status).toBe(201)
    ownFoodTypeId = (await createRes.json()).id

    const otherCreateRes = await app.request('/v1/food-types', {
      method: 'POST',
      headers: { Authorization: otherAuthHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Tipo De Otro Usuario IDOR Test' }),
    })
    expect(otherCreateRes.status).toBe(201)
    otherFoodTypeId = (await otherCreateRes.json()).id

    const otherRecipeRes = await app.request('/v1/recipes', {
      method: 'POST',
      headers: { Authorization: otherAuthHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(baseRecipe),
    })
    expect(otherRecipeRes.status).toBe(201)
    otherRecipeId = (await otherRecipeRes.json()).id
  })

  describe('GET /v1/food-types', () => {
    it("only shows own custom food types plus system ones, not another owner's", async () => {
      const res = await app.request('/v1/food-types', { headers: { Authorization: authHeader } })
      expect(res.status).toBe(200)
      const ids = (await res.json()).map((f: { id: string }) => f.id)
      expect(ids).toContain(ownFoodTypeId)
      expect(ids).not.toContain(otherFoodTypeId)
    })
  })

  describe('POST /v1/recipes/:id/relations', () => {
    it("returns 404 for another owner's recipe (cannot attach a relation to it)", async () => {
      const res = await app.request(`/v1/recipes/${otherRecipeId}/relations`, {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ toId: otherRecipeId, relationType: 'similar' }),
      })
      expect(res.status).toBe(404)
    })

    it('creates a relation on a recipe the caller owns', async () => {
      const ownRecipeRes = await app.request('/v1/recipes', {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...baseRecipe, title: 'Mi Receta' }),
      })
      const ownRecipeId = (await ownRecipeRes.json()).id
      const res = await app.request(`/v1/recipes/${ownRecipeId}/relations`, {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ toId: otherRecipeId, relationType: 'similar' }),
      })
      expect(res.status).toBe(201)
    })
  })

  describe('GET /v1/recipes/:id/relations', () => {
    it("returns 404 for another owner's recipe (cannot read its relations)", async () => {
      const res = await app.request(`/v1/recipes/${otherRecipeId}/relations`, {
        headers: { Authorization: authHeader },
      })
      expect(res.status).toBe(404)
    })
  })
})
