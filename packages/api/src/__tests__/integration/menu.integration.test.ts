import { describe, it, expect, beforeAll } from 'vitest'

const skip = process.env['SKIP_INTEGRATION'] === 'true'
import app from '../../index.js'
import { TEST_API_KEY, resetTestDb } from './globalSetup.js'

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
    await resetTestDb()

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

  it('GET /v1/menu/shopping-list tags each item with an aisle and an unchecked default', async () => {
    const res = await app.request('/v1/menu/shopping-list?weekStart=2026-07-07', {
      headers: { Authorization: auth },
    })
    const list = await res.json()
    const pasta = list.find((i: { ingredient: string }) => i.ingredient === 'pasta')
    expect(pasta.aisle).toBe('almacen')
    expect(pasta.key).toBe('pasta')
    expect(pasta.checked).toBe(false)
  })

  it('combines ingredient synonyms into one canonical line while distinct cuts stay apart', async () => {
    const week = '2026-08-03' // a Monday, isolated from the other menu tests
    const mk = async (title: string, ingredient: string) => {
      const r = await app.request('/v1/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({
          title,
          servings: 1,
          category: 'Cena',
          ingredients: [{ name: ingredient, quantity: 200, unit: 'g' }],
          steps: [{ text: 'Cocinar.' }],
        }),
      })
      return (await r.json()).id as string
    }
    // Two recipes use different words for chicken breast; a third uses a thigh.
    const supremaId = await mk('Suprema Recipe', 'Suprema de pollo')
    const pechugaId = await mk('Pechuga Recipe', 'Pechuga')
    const musloId = await mk('Muslo Recipe', 'Muslo de pollo')
    for (const [i, id] of [supremaId, pechugaId, musloId].entries()) {
      await app.request('/v1/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({ date: week, slot: 'Cena', recipeId: id, servings: 1 }),
      })
      void i
    }

    const res = await app.request(`/v1/menu/shopping-list?weekStart=${week}`, {
      headers: { Authorization: auth },
    })
    const list = (await res.json()) as { ingredient: string; quantity: number; key: string }[]
    const pollo = list.find((i) => i.ingredient === 'Pollo')
    expect(pollo).toBeDefined()
    expect(pollo!.key).toBe('pollo')
    expect(pollo!.quantity).toBe(400) // suprema 200g + pechuga 200g combined
    // the thigh is a separate canonical, not merged into pollo
    const muslo = list.find((i) => i.key === 'muslo de pollo')
    expect(muslo).toBeDefined()
    expect(list.filter((i) => i.key === 'pollo')).toHaveLength(1)
  })

  it('flags shopping-list items already in the in-stock pantry', async () => {
    const week = '2026-09-07' // a Monday, isolated
    const recipe = await (
      await app.request('/v1/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({
          title: 'Pantry Match Recipe',
          servings: 1,
          category: 'Cena',
          ingredients: [
            { name: 'Arroz', quantity: 100, unit: 'g' },
            { name: 'Sal', quantity: null, unit: null },
          ],
          steps: [{ text: 'Cocinar.' }],
        }),
      })
    ).json()
    await app.request('/v1/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ date: week, slot: 'Cena', recipeId: recipe.id, servings: 1 }),
    })
    // Household has rice in stock, but salt is marked out of stock.
    await app.request('/v1/pantry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ name: 'arroz', inStock: true }),
    })
    await app.request('/v1/pantry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ name: 'sal', inStock: false }),
    })

    const list = (await (
      await app.request(`/v1/menu/shopping-list?weekStart=${week}`, {
        headers: { Authorization: auth },
      })
    ).json()) as { key: string; pantryMatch: boolean }[]
    expect(list.find((i) => i.key === 'arroz')?.pantryMatch).toBe(true)
    expect(list.find((i) => i.key === 'sal')?.pantryMatch).toBe(false)
  })

  it('GET /v1/menu/missing-ingredients diffs the planned week against the pantry', async () => {
    const week = '2026-10-05' // a Monday, isolated
    const mk = async (title: string, ings: string[]) =>
      (await (
        await app.request('/v1/recipes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: auth },
          body: JSON.stringify({
            title,
            servings: 1,
            category: 'Cena',
            ingredients: ings.map((name) => ({ name, quantity: 1, unit: 'unit' })),
            steps: [{ text: 'Cocinar.' }],
          }),
        })
      ).json()) as { id: string }

    const cookable = await mk('Solo arroz', ['Arroz'])
    const incompleta = await mk('Arroz con pollo', ['Arroz', 'Pollo'])
    for (const id of [cookable.id, incompleta.id]) {
      await app.request('/v1/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({ date: week, slot: 'Cena', recipeId: id, servings: 1 }),
      })
    }
    // Only rice is in stock.
    await app.request('/v1/pantry/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ items: [{ name: 'Arroz', inStock: true }] }),
    })

    const body = (await (
      await app.request(`/v1/menu/missing-ingredients?weekStart=${week}`, {
        headers: { Authorization: auth },
      })
    ).json()) as {
      missing: { key: string }[]
      meals: { recipeId: string; cookable: boolean; missingIngredients: string[] }[]
    }

    // Combined missing has pollo but not the in-stock arroz.
    expect(body.missing.some((m) => m.key === 'pollo')).toBe(true)
    expect(body.missing.some((m) => m.key === 'arroz')).toBe(false)
    // The rice-only meal is cookable; the other is not (missing pollo).
    expect(body.meals.find((m) => m.recipeId === cookable.id)?.cookable).toBe(true)
    const incompletaMeal = body.meals.find((m) => m.recipeId === incompleta.id)!
    expect(incompletaMeal.cookable).toBe(false)
    expect(incompletaMeal.missingIngredients).toContain('Pollo')
  })

  it('PUT /v1/menu/shopping-list/check persists a check across reloads and can be undone', async () => {
    const check = (checked: boolean) =>
      app.request('/v1/menu/shopping-list/check', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({ weekStart: '2026-07-07', key: 'pasta', checked }),
      })

    const put = await check(true)
    expect(put.status).toBe(200)
    expect(await put.json()).toEqual({ ok: true })

    let list = await (
      await app.request('/v1/menu/shopping-list?weekStart=2026-07-07', {
        headers: { Authorization: auth },
      })
    ).json()
    expect(list.find((i: { ingredient: string }) => i.ingredient === 'pasta').checked).toBe(true)

    // Unchecking flips it back (upsert on the same owner/week/key row)
    await check(false)
    list = await (
      await app.request('/v1/menu/shopping-list?weekStart=2026-07-07', {
        headers: { Authorization: auth },
      })
    ).json()
    expect(list.find((i: { ingredient: string }) => i.ingredient === 'pasta').checked).toBe(false)
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

  it('getScaledIngredients: scales qty by entryServings/recipeServings exactly', async () => {
    // Recipe has 200g pasta for 4 servings. Entry orders 8 servings → expect 400g.
    const createRes = await app.request('/v1/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({
        title: 'Scale Test Recipe',
        servings: 4,
        category: 'Cena',
        ingredients: [{ name: 'scale-pasta', quantity: 200, unit: 'g' }],
        steps: [],
      }),
    })
    const scaleRecipe = (await createRes.json()) as { id: string }

    await app.request('/v1/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({
        date: '2026-07-10',
        slot: 'Almuerzo',
        recipeId: scaleRecipe.id,
        servings: 8,
      }),
    })

    const res = await app.request('/v1/menu/shopping-list?weekStart=2026-07-07', {
      headers: { Authorization: auth },
    })
    const list = await res.json()
    const item = (
      list as { ingredient: string; quantity: number | null; unit: string | null }[]
    ).find((i) => i.ingredient === 'scale-pasta')
    expect(item).toBeDefined()
    expect(item?.quantity).toBe(400) // 200 * (8/4)
    expect(item?.unit).toBe('g')
  })

  // Regression test for GitHub issue #44: the shopping list must only include
  // ingredients from entries dated within [weekStart, weekStart+6] inclusive —
  // entries from the adjacent week (day before weekStart, or day after
  // weekStart+6) must never leak in.
  it('getScaledIngredients: excludes entries from the adjacent week (day before/after)', async () => {
    const createRes = await app.request('/v1/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({
        title: 'Adjacent Week Recipe',
        servings: 1,
        category: 'Cena',
        ingredients: [{ name: 'adjacent-week-marker', quantity: 1, unit: 'unit' }],
        steps: [],
      }),
    })
    const adjacentRecipe = (await createRes.json()) as { id: string }

    // Day before weekStart (2026-07-06) and day after weekStart+6 (2026-07-14)
    // both fall outside the [2026-07-07, 2026-07-13] window.
    for (const date of ['2026-07-06', '2026-07-14']) {
      await app.request('/v1/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({ date, slot: 'Almuerzo', recipeId: adjacentRecipe.id, servings: 1 }),
      })
    }

    const res = await app.request('/v1/menu/shopping-list?weekStart=2026-07-07', {
      headers: { Authorization: auth },
    })
    const list = (await res.json()) as { ingredient: string }[]
    expect(list.find((i) => i.ingredient === 'adjacent-week-marker')).toBeUndefined()
  })
})

// Story: day nutrition rollup (nutrition-goals epic story 2).
describe.skipIf(skip).sequential('Day nutrition rollup', () => {
  let token: string
  let recipeWithNutrition: string
  let recipeNoNutrition: string
  const authFor = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` })

  beforeAll(async () => {
    await resetTestDb()
    // A real registered user (uuid) — the API-key owner has no users row, so it
    // can't own a profile (user_profiles.user_id is a uuid FK).
    const reg = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `nutri-${Date.now()}@example.com`, password: 'password123' }),
    })
    token = (await reg.json()).token

    await app.request('/auth/profile', {
      method: 'PATCH',
      headers: authFor(),
      body: JSON.stringify({
        nutritionTargets: {
          daily_calories: 2000,
          daily_protein_g: 100,
          daily_carbs_g: 250,
          daily_fat_g: 70,
        },
      }),
    })

    const withN = await app.request('/v1/recipes', {
      method: 'POST',
      headers: authFor(),
      body: JSON.stringify({
        title: 'Con Nutrición',
        servings: 2,
        category: 'Almuerzo',
        ingredients: [{ name: 'x', quantity: 1, unit: 'g' }],
        steps: [{ text: 'a' }],
        nutrition: { calories: 500, protein_g: 30, carbs_g: 50, fat_g: 15 },
      }),
    })
    recipeWithNutrition = (await withN.json()).id

    const noN = await app.request('/v1/recipes', {
      method: 'POST',
      headers: authFor(),
      body: JSON.stringify({
        title: 'Sin Nutrición',
        servings: 2,
        category: 'Cena',
        ingredients: [{ name: 'y', quantity: 1, unit: 'g' }],
        steps: [{ text: 'b' }],
      }),
    })
    recipeNoNutrition = (await noN.json()).id
  })

  it('rolls up the day with a signed delta and partial flag', async () => {
    const date = '2026-08-03'
    await app.request('/v1/menu', {
      method: 'POST',
      headers: authFor(),
      body: JSON.stringify({ date, slot: 'Almuerzo', recipeId: recipeWithNutrition, servings: 3 }),
    })
    await app.request('/v1/menu', {
      method: 'POST',
      headers: authFor(),
      body: JSON.stringify({ date, slot: 'Cena', recipeId: recipeNoNutrition, servings: 1 }),
    })

    const res = await app.request(`/v1/menu/day-nutrition?date=${date}`, { headers: authFor() })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.totals.calories).toBe(1500) // 500/serving × 3; no-nutrition Cena excluded
    expect(body.delta.calories).toBe(-500)
    expect(body.partial).toBe(true)
    expect(body.missingCount).toBe(1)
    expect(
      body.byMeal.find((m: { mealCategory: string }) => m.mealCategory === 'Almuerzo'),
    ).toBeTruthy()
  })

  it('returns zeros and a full negative delta for an empty day', async () => {
    const res = await app.request('/v1/menu/day-nutrition?date=2026-08-15', { headers: authFor() })
    const body = await res.json()
    expect(body.totals.calories).toBe(0)
    expect(body.delta.calories).toBe(-2000)
    expect(body.partial).toBe(false)
  })

  it('a registered user without goals set gets a null target', async () => {
    const reg = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `sin-goals-${Date.now()}@example.com`,
        password: 'password123',
      }),
    })
    const t = (await reg.json()).token
    const res = await app.request('/v1/menu/day-nutrition?date=2026-08-03', {
      headers: { Authorization: `Bearer ${t}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.target).toBeNull()
    expect(body.delta).toBeNull()
  })

  it('an API-key (non-uuid) owner gets no target instead of a DB error', async () => {
    // 'test-owner' is not a uuid → the profile lookup must be skipped, not crash
    const res = await app.request('/v1/menu/day-nutrition?date=2026-08-03', {
      headers: { Authorization: `Bearer ${TEST_API_KEY}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.target).toBeNull()
    expect(body.delta).toBeNull()
  })
})
