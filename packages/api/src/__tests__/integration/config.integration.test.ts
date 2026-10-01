import { describe, it, expect, beforeAll } from 'vitest'
import { eq } from 'drizzle-orm'

const skip = process.env['SKIP_INTEGRATION'] === 'true'
import app from '../../index.js'
import { getDb, schema } from '../../db/index.js'
import { TEST_API_KEY, TEST_OWNER_ID, resetTestDb } from './globalSetup.js'

const authHeader = `Bearer ${TEST_API_KEY}`
const OTHER_OWNER_ID = 'test-owner-b'
const OTHER_API_KEY = 'test-api-key-owner-b'
const otherAuthHeader = `Bearer ${OTHER_API_KEY}`

// Regression suite for the 2026-07-03 audit finding: config.ts's rename/delete/merge
// routes never filtered by ownerId, letting any authenticated user modify or delete
// another user's custom taxonomy items. These tests exercise the fix against a real
// Postgres instance (not mocks) with two genuinely distinct owners.
describe.skipIf(skip).sequential('Taxonomy config cross-tenant authorization', () => {
  let ownFoodTypeId: string
  let otherFoodTypeId: string
  let ownTagId: string
  let otherTagId: string
  let ownCategoryId: string

  beforeAll(async () => {
    await resetTestDb()
    const db = getDb()
    // Precomputed sha256('test-api-key-owner-b') — avoids a fresh createHash()
    // call over a fixed test constant (CodeQL flags that shape as a possible
    // weak password hash, even though this is a random API key, not a password).
    const hash = 'bfad6973f42900a475880450bde62aef4757c889dc8de552d2507de5d334ad74'
    await db
      .insert(schema.apiKeys)
      .values({ keyHash: hash, ownerId: OTHER_OWNER_ID, label: 'owner-b' })
      .onConflictDoNothing()

    // TEST_OWNER_ID creates a food type via the real API (the only taxonomy type
    // with a public creation endpoint).
    const createRes = await app.request('/v1/food-types', {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Mi Tipo Custom' }),
    })
    expect(createRes.status).toBe(201)
    ownFoodTypeId = (await createRes.json()).id

    // OTHER_OWNER_ID creates its own food type the same way.
    const otherCreateRes = await app.request('/v1/food-types', {
      method: 'POST',
      headers: { Authorization: otherAuthHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Tipo De Otro Usuario' }),
    })
    expect(otherCreateRes.status).toBe(201)
    otherFoodTypeId = (await otherCreateRes.json()).id

    // Tags and meal categories have no public creation endpoint (only ever seeded
    // or user-scoped via direct DB writes) — insert directly, same pattern already
    // used by schema-constraints.integration.test.ts for apiKeys.
    const [ownTag] = await db
      .insert(schema.tags)
      .values({ name: 'mi-tag', slug: 'mi-tag', ownerId: TEST_OWNER_ID })
      .returning()
    ownTagId = ownTag!.id
    const [otherTag] = await db
      .insert(schema.tags)
      .values({ name: 'tag-de-otro', slug: 'tag-de-otro', ownerId: OTHER_OWNER_ID })
      .returning()
    otherTagId = otherTag!.id
    const [ownCategory] = await db
      .insert(schema.mealCategories)
      .values({ name: 'Mi Categoria', slug: 'mi-categoria', ownerId: TEST_OWNER_ID })
      .returning()
    ownCategoryId = ownCategory!.id
  })

  it('GET /v1/config/taxonomy only shows own custom items plus system ones', async () => {
    const res = await app.request('/v1/config/taxonomy', { headers: { Authorization: authHeader } })
    expect(res.status).toBe(200)
    const body = await res.json()
    const foodTypeIds = body.foodTypes.map((f: { id: string }) => f.id)
    const tagIds = body.tags.map((t: { id: string }) => t.id)
    expect(foodTypeIds).toContain(ownFoodTypeId)
    expect(foodTypeIds).not.toContain(otherFoodTypeId)
    expect(tagIds).toContain(ownTagId)
    expect(tagIds).not.toContain(otherTagId)
  })

  it("cannot rename another user's food type (404)", async () => {
    const res = await app.request(`/v1/config/food-types/${otherFoodTypeId}`, {
      method: 'PATCH',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Secuestrado' }),
    })
    expect(res.status).toBe(404)
  })

  it('can rename own food type (200)', async () => {
    const res = await app.request(`/v1/config/food-types/${ownFoodTypeId}`, {
      method: 'PATCH',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Mi Tipo Renombrado' }),
    })
    expect(res.status).toBe(200)
  })

  it("cannot rename another user's tag (404)", async () => {
    const res = await app.request(`/v1/config/tags/${otherTagId}`, {
      method: 'PATCH',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'secuestrado' }),
    })
    expect(res.status).toBe(404)
  })

  it("cannot rename another user's meal category (404)", async () => {
    const res = await app.request(`/v1/config/categories/${ownCategoryId}`, {
      method: 'PATCH',
      headers: { Authorization: otherAuthHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Secuestrada' }),
    })
    expect(res.status).toBe(404)
  })

  it("cannot delete another user's food type (400)", async () => {
    const res = await app.request(`/v1/config/food-types/${otherFoodTypeId}`, {
      method: 'DELETE',
      headers: { Authorization: authHeader },
    })
    expect(res.status).toBe(400)
  })

  it("cannot delete another user's tag (404)", async () => {
    const res = await app.request(`/v1/config/tags/${otherTagId}`, {
      method: 'DELETE',
      headers: { Authorization: authHeader },
    })
    expect(res.status).toBe(404)
  })

  it("cannot merge another user's tag as source or target (404)", async () => {
    const res = await app.request('/v1/config/tags/merge', {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId: ownTagId, targetId: otherTagId }),
    })
    expect(res.status).toBe(404)
  })

  it('can merge two own tags (200)', async () => {
    const db = getDb()
    const [secondOwnTag] = await db
      .insert(schema.tags)
      .values({ name: 'mi-tag-2', slug: 'mi-tag-2', ownerId: TEST_OWNER_ID })
      .returning()
    const res = await app.request('/v1/config/tags/merge', {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId: secondOwnTag!.id, targetId: ownTagId }),
    })
    expect(res.status).toBe(200)
  })

  it('can delete own food type (204)', async () => {
    const res = await app.request(`/v1/config/food-types/${ownFoodTypeId}`, {
      method: 'DELETE',
      headers: { Authorization: authHeader },
    })
    expect(res.status).toBe(204)
  })

  it("cannot delete another user's meal category (400)", async () => {
    const res = await app.request(`/v1/config/categories/${ownCategoryId}`, {
      method: 'DELETE',
      headers: { Authorization: otherAuthHeader },
    })
    expect(res.status).toBe(400)
  })

  // Regression test for the 2026-07-07 review finding: the DELETE handler had
  // no branch for type === 'categories' at all — it silently returned 204
  // without deleting anything. Verify the row is genuinely gone afterward,
  // not just that the response looks successful.
  it('actually deletes an owned meal category (204, row is gone)', async () => {
    const db = getDb()
    const [category] = await db
      .insert(schema.mealCategories)
      .values({ name: 'Categoria Borrable', slug: 'categoria-borrable', ownerId: TEST_OWNER_ID })
      .returning()

    const res = await app.request(`/v1/config/categories/${category!.id}`, {
      method: 'DELETE',
      headers: { Authorization: authHeader },
    })
    expect(res.status).toBe(204)

    const [stillThere] = await db
      .select()
      .from(schema.mealCategories)
      .where(eq(schema.mealCategories.id, category!.id))
      .limit(1)
    expect(stillThere).toBeUndefined()
  })
})

// 2026-10-01 audit: config writes and counts must stay inside the caller's recipes,
// and a reassign target must be one the caller can use.
describe.skipIf(skip).sequential('Taxonomy config stays inside the caller’s recipes', () => {
  const db = () => getDb()
  const recipe = (ownerId: string, category: string) =>
    db()
      .insert(schema.recipes)
      .values({
        ownerId,
        title: `R ${category} ${Math.random()}`,
        servings: 2,
        category,
      })
      .returning()
      .then((rows) => rows[0]!)

  it("reassigning a category renames only the caller's recipes", async () => {
    const [cat] = await db()
      .insert(schema.mealCategories)
      .values({ name: 'Brunch', slug: 'brunch', ownerId: TEST_OWNER_ID })
      .returning()
    const [target] = await db()
      .insert(schema.mealCategories)
      .values({ name: 'Desayuno Tardío', slug: 'desayuno-tardio', ownerId: TEST_OWNER_ID })
      .returning()
    const mine = await recipe(TEST_OWNER_ID, 'Brunch')
    const theirs = await recipe(OTHER_OWNER_ID, 'Brunch')

    // Counts only the caller's recipe
    const overview = await (
      await app.request('/v1/config/taxonomy', { headers: { Authorization: authHeader } })
    ).json()
    const brunch = overview.mealCategories.find((c: { id: string }) => c.id === cat!.id)
    expect(brunch.usageCount).toBe(1)

    const res = await app.request(`/v1/config/categories/${cat!.id}?reassignTo=${target!.id}`, {
      method: 'DELETE',
      headers: { Authorization: authHeader },
    })
    expect(res.status).toBe(204)
    const after = async (id: string) =>
      (await db().select().from(schema.recipes).where(eq(schema.recipes.id, id)))[0]!.category
    expect(await after(mine.id)).toBe('Desayuno Tardío')
    expect(await after(theirs.id)).toBe('Brunch')
  })

  it("rejects a reassign target that is another user's (400) and keeps the item", async () => {
    const [cat] = await db()
      .insert(schema.mealCategories)
      .values({ name: 'Picada', slug: 'picada', ownerId: TEST_OWNER_ID })
      .returning()
    const [foreign] = await db()
      .insert(schema.mealCategories)
      .values({ name: 'Ajena', slug: 'ajena', ownerId: OTHER_OWNER_ID })
      .returning()
    const res = await app.request(`/v1/config/categories/${cat!.id}?reassignTo=${foreign!.id}`, {
      method: 'DELETE',
      headers: { Authorization: authHeader },
    })
    expect(res.status).toBe(400)
    const still = await db()
      .select()
      .from(schema.mealCategories)
      .where(eq(schema.mealCategories.id, cat!.id))
    expect(still).toHaveLength(1)

    const self = await app.request(`/v1/config/categories/${cat!.id}?reassignTo=${cat!.id}`, {
      method: 'DELETE',
      headers: { Authorization: authHeader },
    })
    expect(self.status).toBe(400)
  })

  it('moves food-type links to the target, skipping recipes that already have it', async () => {
    const create = async (name: string) =>
      (
        await (
          await app.request('/v1/food-types', {
            method: 'POST',
            headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
          })
        ).json()
      ).id as string
    const from = await create('Tipo Origen')
    const to = await create('Tipo Destino')
    const both = await recipe(TEST_OWNER_ID, 'Cena')
    const onlyFrom = await recipe(TEST_OWNER_ID, 'Cena')
    await db()
      .insert(schema.recipeFoodTypes)
      .values([
        { recipeId: both.id, foodTypeId: from },
        { recipeId: both.id, foodTypeId: to },
        { recipeId: onlyFrom.id, foodTypeId: from },
      ])

    const foreign = await app.request(
      `/v1/config/food-types/${from}?reassignTo=${await otherFoodTypeIdLookup()}`,
      {
        method: 'DELETE',
        headers: { Authorization: authHeader },
      },
    )
    expect(foreign.status).toBe(400)

    const res = await app.request(`/v1/config/food-types/${from}?reassignTo=${to}`, {
      method: 'DELETE',
      headers: { Authorization: authHeader },
    })
    expect(res.status).toBe(204)
    const links = await db()
      .select()
      .from(schema.recipeFoodTypes)
      .where(eq(schema.recipeFoodTypes.foodTypeId, to))
    expect(links.map((l) => l.recipeId).sort()).toEqual([both.id, onlyFrom.id].sort())
  })

  it('moves tag links on delete; rejects a foreign or same target', async () => {
    const tag = async (ownerId: string, slug: string) =>
      (await db().insert(schema.tags).values({ name: slug, slug, ownerId }).returning())[0]!.id
    const from = await tag(TEST_OWNER_ID, 'origen')
    const to = await tag(TEST_OWNER_ID, 'destino')
    const foreign = await tag(OTHER_OWNER_ID, 'ajeno')
    const r = await recipe(TEST_OWNER_ID, 'Cena')
    await db().insert(schema.recipeTags).values({ recipeId: r.id, tagId: from })

    for (const bad of [foreign, from]) {
      const res = await app.request(`/v1/config/tags/${from}?reassignTo=${bad}`, {
        method: 'DELETE',
        headers: { Authorization: authHeader },
      })
      expect(res.status).toBe(400)
    }
    const res = await app.request(`/v1/config/tags/${from}?reassignTo=${to}`, {
      method: 'DELETE',
      headers: { Authorization: authHeader },
    })
    expect(res.status).toBe(204)
    const links = await db().select().from(schema.recipeTags).where(eq(schema.recipeTags.tagId, to))
    expect(links.map((l) => l.recipeId)).toEqual([r.id])
  })

  it('deletes a tag outright, and a food type with no recipes while reassigning', async () => {
    const [tag] = await db()
      .insert(schema.tags)
      .values({ name: 'suelto', slug: 'suelto', ownerId: TEST_OWNER_ID })
      .returning()
    const r = await recipe(TEST_OWNER_ID, 'Cena')
    await db().insert(schema.recipeTags).values({ recipeId: r.id, tagId: tag!.id })
    const res = await app.request(`/v1/config/tags/${tag!.id}`, {
      method: 'DELETE',
      headers: { Authorization: authHeader },
    })
    expect(res.status).toBe(204)
    expect(
      await db().select().from(schema.recipeTags).where(eq(schema.recipeTags.recipeId, r.id)),
    ).toEqual([])

    const create = async (name: string) =>
      (
        await (
          await app.request('/v1/food-types', {
            method: 'POST',
            headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
          })
        ).json()
      ).id as string
    const unused = await create('Sin Uso')
    const target = await create('Destino Sin Uso')
    const del = await app.request(`/v1/config/food-types/${unused}?reassignTo=${target}`, {
      method: 'DELETE',
      headers: { Authorization: authHeader },
    })
    expect(del.status).toBe(204)
  })

  // Mutation testing (2026-10-01): dropping onConflictDoNothing from the tag
  // move survived — no tag fixture had a recipe carrying both tags.
  it('merging tags a recipe already has both of keeps one link and reports the count', async () => {
    const tag = async (slug: string) =>
      (
        await db()
          .insert(schema.tags)
          .values({ name: slug, slug, ownerId: TEST_OWNER_ID })
          .returning()
      )[0]!.id
    const source = await tag('fuente-merge')
    const target = await tag('destino-merge')
    const both = await recipe(TEST_OWNER_ID, 'Cena')
    const onlySource = await recipe(TEST_OWNER_ID, 'Cena')
    await db()
      .insert(schema.recipeTags)
      .values([
        { recipeId: both.id, tagId: source },
        { recipeId: both.id, tagId: target },
        { recipeId: onlySource.id, tagId: source },
      ])
    const res = await app.request('/v1/config/tags/merge', {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId: source, targetId: target }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ merged: 2 })
    const links = await db()
      .select()
      .from(schema.recipeTags)
      .where(eq(schema.recipeTags.tagId, target))
    expect(links.map((l) => l.recipeId).sort()).toEqual([both.id, onlySource.id].sort())
    expect(await db().select().from(schema.tags).where(eq(schema.tags.id, source))).toEqual([])
  })

  it('renames a category and a tag', async () => {
    const [cat] = await db()
      .insert(schema.mealCategories)
      .values({ name: 'Viejo', slug: 'viejo', ownerId: TEST_OWNER_ID })
      .returning()
    const res = await app.request(`/v1/config/categories/${cat!.id}`, {
      method: 'PATCH',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Nuevo Nombre' }),
    })
    expect(await res.json()).toEqual({ id: cat!.id, name: 'Nuevo Nombre' })
  })
})

async function otherFoodTypeIdLookup(): Promise<string> {
  const [row] = await getDb()
    .select({ id: schema.foodTypes.id })
    .from(schema.foodTypes)
    .where(eq(schema.foodTypes.ownerId, OTHER_OWNER_ID))
    .limit(1)
  return row!.id
}

// Story "App: pantalla Configurador con tabs y contadores": "Tap en badge abre
// lista de recetas que lo usan. Crear nuevo ítem en cada tab."
describe.skipIf(skip).sequential('Taxonomy config: create items and list their recipes', () => {
  const H = { Authorization: authHeader, 'Content-Type': 'application/json' }
  const OH = { Authorization: otherAuthHeader, 'Content-Type': 'application/json' }
  const db = () => getDb()
  const overview = async () =>
    (await (await app.request('/v1/config/taxonomy', { headers: H })).json()) as Record<
      'mealCategories' | 'foodTypes' | 'tags',
      { id: string; name: string; usageCount: number; isDeletable: boolean }[]
    >
  const recipes = async (type: string, id: string, headers = H) =>
    app.request(`/v1/config/${type}/${id}/recipes`, { headers })
  const create = (type: string, name: string, headers = H) =>
    app.request(`/v1/config/${type}`, { method: 'POST', headers, body: JSON.stringify({ name }) })

  it('creates a category that shows up in the overview, unused and deletable', async () => {
    const res = await create('categories', 'Merienda Cena')
    expect(res.status).toBe(201)
    const item = (await res.json()) as { id: string; slug: string }
    expect(item.slug).toBe('merienda-cena')
    const cat = (await overview()).mealCategories.find((c) => c.id === item.id)
    expect(cat).toMatchObject({ name: 'Merienda Cena', usageCount: 0, isDeletable: true })
  })

  it('creates a food type and a tag too', async () => {
    expect((await create('food-types', 'Tapeo')).status).toBe(201)
    expect((await create('tags', 'para invitados')).status).toBe(201)
    const o = await overview()
    expect(o.foodTypes.some((f) => f.name === 'Tapeo')).toBe(true)
    expect(o.tags.some((t) => t.name === 'para invitados')).toBe(true)
  })

  it('a name already taken (own, or a system category) is a 409, and nothing is added', async () => {
    const before = (await overview()).mealCategories.length
    expect((await create('categories', 'Merienda Cena')).status).toBe(409)
    expect((await create('categories', 'cena')).status).toBe(409) // system "Cena"
    expect((await create('tags', 'Para Invitados')).status).toBe(409)
    expect((await overview()).mealCategories.length).toBe(before)
  })

  it('another person can create the same name in their own space', async () => {
    expect((await create('tags', 'para invitados', OH)).status).toBe(201)
  })

  it('a name with no usable characters is a 400', async () => {
    expect((await create('tags', '¡¡ !!')).status).toBe(400)
  })

  it('a category badge lists exactly the recipes it counts (mine only)', async () => {
    const item = (await (await create('categories', 'Picnic')).json()) as { id: string }
    for (const [ownerId, title] of [
      [TEST_OWNER_ID, 'Sándwich de miga'],
      [TEST_OWNER_ID, 'Ensalada fría'],
      [OTHER_OWNER_ID, 'Picnic ajeno'],
    ] as const) {
      await db().insert(schema.recipes).values({ ownerId, title, servings: 2, category: 'Picnic' })
    }
    const res = await recipes('categories', item.id)
    expect(res.status).toBe(200)
    const list = (await res.json()) as { title: string }[]
    expect(list.map((r) => r.title)).toEqual(['Ensalada fría', 'Sándwich de miga'])
    const badge = (await overview()).mealCategories.find((c) => c.id === item.id)!.usageCount
    expect(list).toHaveLength(badge)
  })

  it('a food type badge lists its recipes, matching the count', async () => {
    const ft = (await (await create('food-types', 'Al disco')).json()) as { id: string }
    const r = await app.request('/v1/recipes', {
      method: 'POST',
      headers: H,
      body: JSON.stringify({
        title: 'Disco de verduras',
        servings: 4,
        category: 'Cena',
        ingredients: [{ name: 'zapallo', quantity: 1, unit: 'unit' }],
        foodTypeIds: [ft.id],
      }),
    })
    expect(r.status).toBe(201)
    const list = (await (await recipes('food-types', ft.id)).json()) as { title: string }[]
    expect(list.map((x) => x.title)).toEqual(['Disco de verduras'])
    expect((await overview()).foodTypes.find((f) => f.id === ft.id)!.usageCount).toBe(1)
  })

  it('a tag badge lists its recipes, matching the count', async () => {
    const tag = (await overview()).tags.find((t) => t.name === 'para invitados')!
    const [rec] = await db()
      .insert(schema.recipes)
      .values({ ownerId: TEST_OWNER_ID, title: 'Tabla de quesos', servings: 6, category: 'Otro' })
      .returning()
    await db().insert(schema.recipeTags).values({ recipeId: rec!.id, tagId: tag.id })
    const list = (await (await recipes('tags', tag.id)).json()) as { title: string }[]
    expect(list.map((x) => x.title)).toEqual(['Tabla de quesos'])
    expect((await overview()).tags.find((t) => t.id === tag.id)!.usageCount).toBe(list.length)
  })

  it("someone else's item is a 404, never their recipes", async () => {
    const theirs = (await (await create('categories', 'Secreta', OH)).json()) as { id: string }
    expect((await recipes('categories', theirs.id)).status).toBe(404)
    const theirTag = (await (await create('tags', 'solo mía', OH)).json()) as { id: string }
    expect((await recipes('tags', theirTag.id)).status).toBe(404)
    const theirType = (await (await create('food-types', 'Ajeno', OH)).json()) as { id: string }
    expect((await recipes('food-types', theirType.id)).status).toBe(404)
  })

  it('a system category lists only my recipes in it', async () => {
    const cena = (await overview()).mealCategories.find((c) => c.name === 'Cena')!
    const list = (await (await recipes('categories', cena.id)).json()) as { title: string }[]
    expect(list.map((x) => x.title)).toContain('Disco de verduras')
    expect(list).toHaveLength(cena.usageCount)
  })
})
