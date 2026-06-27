import { describe, it, expect, beforeAll } from 'vitest'

const skip = process.env['SKIP_INTEGRATION'] === 'true'
import { scaleQuantity } from '@recetario/shared'
import app from '../../index.js'
import { resetDb } from '../../db/index.js'
import { TEST_API_KEY } from './globalSetup.js'

const authHeader = `Bearer ${TEST_API_KEY}`

describe.skipIf(skip).sequential('API E2E: auth → create → search → scale', () => {
  beforeAll(() => {
    resetDb()
  })

  it('full MVP happy path', async () => {
    // 1. Unauthorized request is rejected
    const noAuth = await app.request('/v1/recipes', { method: 'GET' })
    expect(noAuth.status).toBe(401)

    // 2. Create a recipe
    const recipe = {
      title: 'E2E Smoothie de Banana',
      servings: 2,
      category: 'Bebida' as const,
      tags: ['healthy', 'e2e'],
      ingredients: [
        { name: 'banana', quantity: 2, unit: 'unit' as const },
        { name: 'milk', quantity: 200, unit: 'ml' as const },
        { name: 'honey', quantity: null, unit: null },
      ],
      steps: [{ text: 'Blend everything.' }],
      prepTimeMin: 5,
    }

    const createRes = await app.request('/v1/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify(recipe),
    })
    expect(createRes.status).toBe(201)
    const created = await createRes.json()
    expect(created.id).toBeTruthy()
    expect(created.title).toBe(recipe.title)

    // 3. Search for it
    const searchRes = await app.request('/v1/recipes/search?q=E2E+Smoothie', {
      headers: { Authorization: authHeader },
    })
    expect(searchRes.status).toBe(200)
    const results = await searchRes.json()
    expect(results.some((r: { id: string }) => r.id === created.id)).toBe(true)

    // 4. Fetch by ID
    const getRes = await app.request(`/v1/recipes/${created.id}`, {
      headers: { Authorization: authHeader },
    })
    expect(getRes.status).toBe(200)
    const fetched = await getRes.json()
    expect(fetched.ingredients).toHaveLength(3)

    // 5. Scale: double the servings (2 → 4)
    const milkIngredient = fetched.ingredients.find((i: { name: string }) => i.name === 'milk')
    const scaledMilk = scaleQuantity(milkIngredient.quantity, fetched.servings, 4)
    expect(scaledMilk).toBe(400) // 200ml × 2

    const honeyIngredient = fetched.ingredients.find((i: { name: string }) => i.name === 'honey')
    const scaledHoney = scaleQuantity(honeyIngredient.quantity, fetched.servings, 4)
    expect(scaledHoney).toBeNull() // "to taste" stays null
  })
})
