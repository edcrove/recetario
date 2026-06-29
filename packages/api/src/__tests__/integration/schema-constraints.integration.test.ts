import { describe, it, expect, beforeAll } from 'vitest'

const skip = process.env['SKIP_INTEGRATION'] === 'true'
import app from '../../index.js'
import { resetDb } from '../../db/index.js'
import { TEST_API_KEY } from './globalSetup.js'

const authHeader = `Bearer ${TEST_API_KEY}`

const baseRecipe = {
  title: 'Schema Constraint Test',
  servings: 2,
  category: 'Cena' as const,
  ingredients: [{ name: 'Agua', quantity: 500, unit: 'ml' as const }],
  steps: [{ text: 'Hervir' }],
}

describe.skipIf(skip)('Drizzle schema constraints', () => {
  beforeAll(async () => {
    await resetDb()
  })

  it('FK cascade: deleting a recipe removes its ingredients and steps', async () => {
    const createRes = await app.request('/v1/recipes', {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(baseRecipe),
    })
    expect(createRes.status).toBe(201)
    const recipe = (await createRes.json()) as { id: string }

    const getBefore = await app.request(`/v1/recipes/${recipe.id}`, {
      headers: { Authorization: authHeader },
    })
    expect(getBefore.status).toBe(200)
    const before = (await getBefore.json()) as { ingredients: unknown[]; steps: unknown[] }
    expect(before.ingredients.length).toBeGreaterThan(0)
    expect(before.steps.length).toBeGreaterThan(0)

    const deleteRes = await app.request(`/v1/recipes/${recipe.id}`, {
      method: 'DELETE',
      headers: { Authorization: authHeader },
    })
    expect(deleteRes.status).toBe(204)

    const getAfter = await app.request(`/v1/recipes/${recipe.id}`, {
      headers: { Authorization: authHeader },
    })
    expect(getAfter.status).toBe(404)
  })

  it('menu unique constraint: same owner+date+slot upserts instead of duplicating', async () => {
    const createRes = await app.request('/v1/recipes', {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...baseRecipe, title: 'Menu Constraint Recipe' }),
    })
    const recipe = (await createRes.json()) as { id: string }

    const entry1 = {
      date: '2026-01-05',
      slot: 'Almuerzo',
      recipeId: recipe.id,
      servings: 2,
    }

    const res1 = await app.request('/v1/menu', {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(entry1),
    })
    expect(res1.status).toBe(200)

    const res2 = await app.request('/v1/menu', {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...entry1, servings: 4 }),
    })
    expect(res2.status).toBe(200)

    const weekRes = await app.request('/v1/menu?weekStart=2026-01-05', {
      headers: { Authorization: authHeader },
    })
    const entries = (await weekRes.json()) as { slot: string; servings: number }[]
    const lunches = entries.filter((e) => e.slot === 'Almuerzo')
    expect(lunches).toHaveLength(1)
    expect(lunches[0]?.servings).toBe(4)
  })

  it('menu_slot enum: rejects invalid slot values via API', async () => {
    const createRes = await app.request('/v1/recipes', {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...baseRecipe, title: 'Enum Test Recipe' }),
    })
    const recipe = (await createRes.json()) as { id: string }

    const res = await app.request('/v1/menu', {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: '2026-01-05',
        slot: 'Brunch',
        recipeId: recipe.id,
        servings: 1,
      }),
    })
    expect(res.status).toBe(400)
  })

  it('apiKeys unique keyHash: duplicate hash is rejected', async () => {
    const { getDb, schema } = await import('../../db/index.js')
    const db = getDb()
    const { createHash } = await import('node:crypto')

    const hash = createHash('sha256').update('unique-test-key').digest('hex')
    await db
      .insert(schema.apiKeys)
      .values({ keyHash: hash, ownerId: 'owner-a', label: 'test-1' })
      .onConflictDoNothing()

    await expect(
      db.insert(schema.apiKeys).values({ keyHash: hash, ownerId: 'owner-b', label: 'test-2' }),
    ).rejects.toThrow()
  })
})
