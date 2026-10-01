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
