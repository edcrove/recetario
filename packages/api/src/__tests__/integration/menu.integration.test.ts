import { describe, it, expect, beforeAll } from 'vitest'

const skip = process.env['SKIP_INTEGRATION'] === 'true'
import app from '../../index.js'
import { resetDb } from '../../db/index.js'
import { TEST_API_KEY } from './globalSetup.js'

const auth = `Bearer ${TEST_API_KEY}`

const baseRecipe = {
  title: 'Menu Integration Pasta',
  servings: 4,
  category: 'Cena' as const,
  ingredients: [
    { name: 'pasta', quantity: 200, unit: 'g' as const },
    { name: 'tomato sauce', quantity: 400, unit: 'g' as const },
  ],
  steps: [{ text: 'Boil pasta.' }],
}

describe.skipIf(skip).sequential('Menu integration tests', () => {
  let recipeId: string

  beforeAll(async () => {
    resetDb()

    // Create a recipe to reference in menu entries
    const res = await app.request('/v1/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify(baseRecipe),
    })
    const body = await res.json()
    recipeId = body.id
  })

  it('POST /v1/menu adds a menu entry (200)', async () => {
    const res = await app.request('/v1/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({
        date: '2026-07-07',
        slot: 'Cena',
        recipeId,
        servings: 4,
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.date).toBe('2026-07-07')
    expect(body.slot).toBe('Cena')
    expect(body.recipeId).toBe(recipeId)
    expect(body.servings).toBe(4)
    expect(body.recipeName).toBe('Menu Integration Pasta')
  })

  it('POST /v1/menu upserts (same slot, different recipe not needed — updates servings)', async () => {
    const res = await app.request('/v1/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({
        date: '2026-07-07',
        slot: 'Cena',
        recipeId,
        servings: 2,
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.servings).toBe(2)
  })

  it('GET /v1/menu returns week entries', async () => {
    const res = await app.request('/v1/menu?weekStart=2026-07-07', {
      headers: { Authorization: auth },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)
    expect(body[0].slot).toBe('Cena')
  })

  it('GET /v1/menu returns empty array for week with no entries', async () => {
    const res = await app.request('/v1/menu?weekStart=2020-01-06', {
      headers: { Authorization: auth },
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('DELETE /v1/menu/:date/:slot removes entry (204)', async () => {
    const res = await app.request('/v1/menu/2026-07-07/Cena', {
      method: 'DELETE',
      headers: { Authorization: auth },
    })

    expect(res.status).toBe(204)
  })

  it('DELETE /v1/menu/:date/:slot returns 404 for missing entry', async () => {
    const res = await app.request('/v1/menu/2026-07-07/Cena', {
      method: 'DELETE',
      headers: { Authorization: auth },
    })

    expect(res.status).toBe(404)
  })

  it('GET /v1/menu returns empty after delete', async () => {
    const res = await app.request('/v1/menu?weekStart=2026-07-07', {
      headers: { Authorization: auth },
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('POST /v1/menu default servings is 1 when not provided', async () => {
    const res = await app.request('/v1/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({
        date: '2026-07-08',
        slot: 'Almuerzo',
        recipeId,
      }),
    })

    expect(res.status).toBe(200)
    expect((await res.json()).servings).toBe(1)
  })

  it('GET /v1/menu/shopping-list returns aggregated ingredients', async () => {
    // Add another entry for the same week to test aggregation
    await app.request('/v1/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ date: '2026-07-09', slot: 'Cena', recipeId, servings: 4 }),
    })

    const res = await app.request('/v1/menu/shopping-list?weekStart=2026-07-07', {
      headers: { Authorization: auth },
    })

    expect(res.status).toBe(200)
    const list = await res.json()
    expect(Array.isArray(list)).toBe(true)
    // Should have aggregated ingredients from the recipe entries
    expect(list.length).toBeGreaterThan(0)
    const pasta = list.find((i: { ingredient: string }) => i.ingredient === 'pasta')
    expect(pasta).toBeDefined()
    expect(pasta.unit).toBe('g')
  })

  it('GET /v1/menu/shopping-list returns empty for week with no menu', async () => {
    const res = await app.request('/v1/menu/shopping-list?weekStart=2020-01-06', {
      headers: { Authorization: auth },
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('GET /v1/menu/shopping-list handles null-quantity ("to taste") ingredients', async () => {
    // Create a recipe with a null-quantity ingredient
    const recipeWithNullQty = {
      title: 'Salt Test Recipe',
      servings: 2,
      category: 'Cena' as const,
      ingredients: [
        { name: 'pasta', quantity: 100, unit: 'g' as const },
        { name: 'salt', quantity: null, unit: null }, // to taste
      ],
      steps: [{ text: 'Cook.' }],
    }
    const createRes = await app.request('/v1/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify(recipeWithNullQty),
    })
    const { id: saltRecipeId } = await createRes.json()

    await app.request('/v1/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({
        date: '2026-07-10',
        slot: 'Cena',
        recipeId: saltRecipeId,
        servings: 2,
      }),
    })

    const res = await app.request('/v1/menu/shopping-list?weekStart=2026-07-07', {
      headers: { Authorization: auth },
    })

    expect(res.status).toBe(200)
    const list = await res.json()
    const salt = list.find((i: { ingredient: string }) => i.ingredient === 'salt')
    expect(salt).toBeDefined()
    expect(salt.quantity).toBeNull()
  })
})
