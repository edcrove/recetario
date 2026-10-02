import { describe, it, expect, beforeAll } from 'vitest'

const skip = process.env['SKIP_INTEGRATION'] === 'true'
import app from '../../index.js'
import { getDb, schema } from '../../db/index.js'
import { TEST_API_KEY, TEST_OWNER_ID, resetTestDb } from './globalSetup.js'

// Latent bug found while fixing the configurator (D-2026-10-01-15): a recipe's
// category was a fixed enum, so a category created in the configurator could
// never be used, and multi-word or accented names never matched their recipes.

const auth = { Authorization: `Bearer ${TEST_API_KEY}`, 'Content-Type': 'application/json' }
const otherAuth = {
  Authorization: 'Bearer test-api-key-owner-b',
  'Content-Type': 'application/json',
}

type Item = { id: string; name: string; usageCount: number }

function recipeBody(title: string, category: string, extra: object = {}) {
  return JSON.stringify({
    title,
    servings: 2,
    category,
    ingredients: [{ name: 'agua', quantity: 1, unit: 'l' }],
    steps: [{ text: 'Paso.' }],
    ...extra,
  })
}

async function createRecipe(title: string, category: string, headers = auth, extra = {}) {
  return app.request('/v1/recipes', {
    method: 'POST',
    headers,
    body: recipeBody(title, category, extra),
  })
}

async function createCategory(name: string, headers = auth): Promise<string> {
  const res = await app.request('/v1/config/categories', {
    method: 'POST',
    headers,
    body: JSON.stringify({ name }),
  })
  expect(res.status).toBe(201)
  return ((await res.json()) as { id: string }).id
}

async function category(name: string, headers = auth): Promise<Item | undefined> {
  const res = await app.request('/v1/config/taxonomy', { headers })
  return ((await res.json()) as { mealCategories: Item[] }).mealCategories.find(
    (c) => c.name === name,
  )
}

async function recipeCategory(id: string): Promise<string> {
  const res = await app.request(`/v1/recipes/${id}`, { headers: auth })
  return ((await res.json()) as { category: string }).category
}

describe.skipIf(skip).sequential('Recipes can use custom categories', () => {
  beforeAll(async () => {
    await resetTestDb()
    await getDb()
      .insert(schema.apiKeys)
      .values({
        keyHash: 'bfad6973f42900a475880450bde62aef4757c889dc8de552d2507de5d334ad74',
        ownerId: 'test-owner-b',
        label: 'owner-b',
      })
      .onConflictDoNothing()
  })

  it('a recipe can use a category created in the configurator, stored by its name', async () => {
    const id = await createCategory('Comida rápida')
    const res = await createRecipe('Hamburguesa', '  comida RÁPIDA ')
    expect(res.status).toBe(201)
    const recipe = (await res.json()) as { id: string; category: string }
    expect(recipe.category).toBe('Comida rápida')
    expect(await category('Comida rápida')).toMatchObject({ usageCount: 1 })
    const used = await app.request(`/v1/config/categories/${id}/recipes`, { headers: auth })
    expect(await used.json()).toEqual([{ id: recipe.id, title: 'Hamburguesa' }])
  })

  it('system categories match any case and store their canonical name', async () => {
    const res = await createRecipe('Sopa', 'cena')
    expect(((await res.json()) as { category: string }).category).toBe('Cena')
  })

  it("an unknown category, or someone else's, is a 400", async () => {
    const unknown = await createRecipe('X', 'Brunch')
    expect(unknown.status).toBe(400)
    expect(await unknown.json()).toEqual({ error: 'Unknown category' })
    await createCategory('Solo mía', otherAuth)
    const foreign = await createRecipe('Y', 'Solo mía')
    expect(foreign.status).toBe(400)
  })

  it('editing a recipe into a custom category moves the count; an unknown one is a 400', async () => {
    const res = await createRecipe('Tostadas', 'Desayuno')
    const { id } = (await res.json()) as { id: string }
    const put = await app.request(`/v1/recipes/${id}`, {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify({ category: 'comida rápida' }),
    })
    expect(put.status).toBe(200)
    expect(await recipeCategory(id)).toBe('Comida rápida')
    expect(await category('Comida rápida')).toMatchObject({ usageCount: 2 })

    const bad = await app.request(`/v1/recipes/${id}`, {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify({ category: 'Inexistente' }),
    })
    expect(bad.status).toBe(400)
    expect(await recipeCategory(id)).toBe('Comida rápida')
  })

  it('renaming a custom category renames it on its recipes', async () => {
    const id = await createCategory('Para el finde')
    const res = await createRecipe('Asado', 'Para el finde')
    const recipe = (await res.json()) as { id: string }
    const other = await createRecipe('Pizza de otro', 'Cena', otherAuth)
    expect(other.status).toBe(201)
    const renamed = await app.request(`/v1/config/categories/${id}`, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ name: 'Fin de semana' }),
    })
    expect(renamed.status).toBe(200)
    expect(await recipeCategory(recipe.id)).toBe('Fin de semana')
    expect(await category('Fin de semana')).toMatchObject({ usageCount: 1 })
  })

  it("renaming someone else's category is a 404 and leaves their recipes alone", async () => {
    const theirs = await createCategory('Ajena', otherAuth)
    const res = await createRecipe('De ellos', 'Ajena', otherAuth)
    expect(res.status).toBe(201)
    const renamed = await app.request(`/v1/config/categories/${theirs}`, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ name: 'Robada' }),
    })
    expect(renamed.status).toBe(404)
    expect(await category('Ajena', otherAuth)).toMatchObject({ usageCount: 1 })
  })

  it('deleting with reassignment to a multi-word category moves its recipes there', async () => {
    const from = await createCategory('Viandas')
    const to = await createCategory('Para llevar')
    const res = await createRecipe('Tarta de verdura', 'Viandas')
    const recipe = (await res.json()) as { id: string }
    const del = await app.request(`/v1/config/categories/${from}?reassignTo=${to}`, {
      method: 'DELETE',
      headers: auth,
    })
    expect(del.status).toBe(204)
    expect(await recipeCategory(recipe.id)).toBe('Para llevar')
    expect(await category('Para llevar')).toMatchObject({ usageCount: 1 })
  })

  it("copying someone's recipe in a category you don't have files it under Otro", async () => {
    const res = await createRecipe('Receta ajena', 'Solo mía', otherAuth, { visibility: 'public' })
    expect(res.status).toBe(201)
    const pub = (await res.json()) as { id: string }
    const copy = await app.request(`/v1/recipes/${pub.id}/copy`, { method: 'POST', headers: auth })
    expect(copy.status).toBe(201)
    expect(((await copy.json()) as { category: string }).category).toBe('Otro')
  })

  it('a recipe saved before (any casing) still counts under its category', async () => {
    const before = (await category('Snack'))!.usageCount
    await getDb()
      .insert(schema.recipes)
      .values({ ownerId: TEST_OWNER_ID, title: 'Vieja', servings: 1, category: 'snack' })
    expect(await category('Snack')).toMatchObject({ usageCount: before + 1 })
  })

  // 2026-10-02 review: create refused a system category's name, but rename
  // didn't, so renaming "Picada" to "cena" made a second "Cena" and every
  // dinner counted under both.
  it('renaming to a name already in use (system or own, any case) is a 409', async () => {
    const id = await createCategory('Picada')
    await createCategory('Merendola')
    const rename = (name: string) =>
      app.request(`/v1/config/categories/${id}`, {
        method: 'PATCH',
        headers: auth,
        body: JSON.stringify({ name }),
      })
    for (const name of ['cena', 'CENA', ' Cena ', 'merendola']) {
      const res = await rename(name)
      expect(res.status).toBe(409)
      expect(await res.json()).toEqual({ error: 'Already exists' })
    }
    expect((await rename('   ')).status).toBe(400)
    // Only a case change of its own name is fine
    expect((await rename('PICADA')).status).toBe(200)
    expect(await category('PICADA')).toBeDefined()
    const cenas = (
      (await (await app.request('/v1/config/taxonomy', { headers: auth })).json()) as {
        mealCategories: Item[]
      }
    ).mealCategories.filter((c) => c.name.toLowerCase() === 'cena')
    expect(cenas).toHaveLength(1)
  })

  it('a food type or a tag renamed onto a name in use is a 409 too', async () => {
    const ft = await app.request('/v1/config/food-types', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ name: 'Frituras' }),
    })
    const ftId = ((await ft.json()) as { id: string }).id
    const ftRes = await app.request(`/v1/config/food-types/${ftId}`, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ name: 'pasta' }),
    })
    expect(ftRes.status).toBe(409)
    const mk = async (name: string) =>
      (
        (await (
          await app.request('/v1/config/tags', {
            method: 'POST',
            headers: auth,
            body: JSON.stringify({ name }),
          })
        ).json()) as { id: string }
      ).id
    const a = await mk('rapida')
    await mk('facil')
    const tagRes = await app.request(`/v1/config/tags/${a}`, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ name: 'FACIL' }),
    })
    expect(tagRes.status).toBe(409)
  })
})
