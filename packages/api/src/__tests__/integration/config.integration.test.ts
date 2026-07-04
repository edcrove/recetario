import { describe, it, expect, beforeAll } from 'vitest'

const skip = process.env['SKIP_INTEGRATION'] === 'true'
import app from '../../index.js'
import { resetDb, getDb, schema } from '../../db/index.js'
import { TEST_API_KEY, TEST_OWNER_ID } from './globalSetup.js'

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
    await resetDb()
    const db = getDb()
    const { createHash } = await import('node:crypto')
    const hash = createHash('sha256').update(OTHER_API_KEY).digest('hex')
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
})
