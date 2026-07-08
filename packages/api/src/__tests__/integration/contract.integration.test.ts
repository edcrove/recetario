import { describe, it, expect, beforeAll } from 'vitest'

const skip = process.env['SKIP_INTEGRATION'] === 'true'
import { RecipeSchema } from '@recetario/shared'
import app from '../../index.js'
import { TEST_API_KEY, resetTestDb } from './globalSetup.js'

const authHeader = `Bearer ${TEST_API_KEY}`

const testRecipe = {
  title: 'Contract Test Tortilla',
  servings: 2,
  category: 'Desayuno' as const,
  ingredients: [
    { name: 'eggs', quantity: 3, unit: 'unit' as const },
    { name: 'potato', quantity: 300, unit: 'g' as const },
  ],
  steps: [{ text: 'Cook potatoes.' }, { text: 'Add eggs and cook.' }],
}

describe.skipIf(skip).sequential('Contract tests vs OpenAPI/Zod schema', () => {
  let recipeId: string

  beforeAll(async () => {
    await resetTestDb()
  })

  it('POST /v1/recipes response conforms to RecipeSchema', async () => {
    const res = await app.request('/v1/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify(testRecipe),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    const parsed = RecipeSchema.safeParse(body)
    expect(parsed.success, `Schema parse failed: ${JSON.stringify(parsed.error?.issues)}`).toBe(
      true,
    )
    recipeId = body.id
  })

  it('GET /v1/recipes/:id response conforms to RecipeSchema', async () => {
    const res = await app.request(`/v1/recipes/${recipeId}`, {
      headers: { Authorization: authHeader },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    const parsed = RecipeSchema.safeParse(body)
    expect(parsed.success, `Schema parse failed: ${JSON.stringify(parsed.error?.issues)}`).toBe(
      true,
    )
  })

  it('GET /v1/recipes list items conform to RecipeSchema', async () => {
    const res = await app.request('/v1/recipes', {
      headers: { Authorization: authHeader },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    // Only validate the recipe created in this test suite — other recipes
    // from seed data may not conform (e.g. zero ingredients from manual seeding)
    const ours = body.filter((item: { id: string }) => item.id === recipeId)
    expect(ours).toHaveLength(1)
    for (const item of ours) {
      const parsed = RecipeSchema.safeParse(item)
      expect(
        parsed.success,
        `Item ${item.id} failed: ${JSON.stringify(parsed.error?.issues)}`,
      ).toBe(true)
    }
  })

  it('GET /openapi.json returns valid OpenAPI 3.1 document', async () => {
    const res = await app.request('/openapi.json')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.openapi).toBe('3.1.0')
    expect(body.info.title).toBe('Recetario API')
    expect(body.paths).toBeDefined()
    expect(body.paths['/v1/recipes']).toBeDefined()
  })
})
