import { describe, it, expect, beforeAll } from 'vitest'
import { eq } from 'drizzle-orm'

const skip = process.env['SKIP_INTEGRATION'] === 'true'
import app from '../../index.js'
import { getDb, schema } from '../../db/index.js'
import { backfillRecipeTags } from '../../db/recipe-tags.js'
import { TEST_API_KEY, TEST_OWNER_ID, resetTestDb } from './globalSetup.js'

// Latent bug found while fixing the configurator badge (D-2026-10-01-15): a
// recipe's `tags` never reached the tag registry, so the configurator's tag
// badges stayed at 0 and rename/merge/delete never touched real recipes.

const auth = { Authorization: `Bearer ${TEST_API_KEY}`, 'Content-Type': 'application/json' }
const OTHER_OWNER_ID = 'test-owner-b'
const otherAuth = {
  Authorization: 'Bearer test-api-key-owner-b',
  'Content-Type': 'application/json',
}

type Tag = { id: string; name: string; slug: string; usageCount: number; isDeletable: boolean }

async function createRecipe(title: string, tags: string[], headers = auth) {
  const res = await app.request('/v1/recipes', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title,
      servings: 2,
      category: 'Cena',
      tags,
      ingredients: [{ name: 'agua', quantity: 1, unit: 'l' }],
      steps: [{ text: 'Paso.' }],
    }),
  })
  expect(res.status).toBe(201)
  return (await res.json()) as { id: string; tags: string[] }
}

async function myTags(headers = auth): Promise<Tag[]> {
  const res = await app.request('/v1/config/taxonomy', { headers })
  return ((await res.json()) as { tags: Tag[] }).tags
}

async function tagNamed(name: string, headers = auth): Promise<Tag | undefined> {
  return (await myTags(headers)).find((t) => t.name === name)
}

async function recipeTags(id: string): Promise<string[]> {
  const res = await app.request(`/v1/recipes/${id}`, { headers: auth })
  return ((await res.json()) as { tags: string[] }).tags
}

async function titlesWithTag(tag: string): Promise<string[]> {
  const res = await app.request(`/v1/recipes/search?tag=${encodeURIComponent(tag)}`, {
    headers: auth,
  })
  const body = (await res.json()) as { data?: { title: string }[] } | { title: string }[]
  const list = Array.isArray(body) ? body : (body.data ?? [])
  return list.map((r) => r.title).sort()
}

describe.skipIf(skip).sequential('Recipe tags feed the tag registry', () => {
  beforeAll(async () => {
    await resetTestDb()
    await getDb()
      .insert(schema.apiKeys)
      .values({
        keyHash: 'bfad6973f42900a475880450bde62aef4757c889dc8de552d2507de5d334ad74',
        ownerId: OTHER_OWNER_ID,
        label: 'owner-b',
      })
      .onConflictDoNothing()
  })

  it('creating a recipe registers its tags and the badge counts it', async () => {
    const r = await createRecipe('Tarta rápida', ['Rápido', 'al horno'])
    const rapido = await tagNamed('Rápido')
    expect(rapido).toMatchObject({ slug: 'rpido', usageCount: 1, isDeletable: false })
    expect(await tagNamed('al horno')).toMatchObject({ slug: 'al-horno', usageCount: 1 })
    const used = await app.request(`/v1/config/tags/${rapido!.id}/recipes`, { headers: auth })
    expect(await used.json()).toEqual([{ id: r.id, title: 'Tarta rápida' }])
  })

  it('spellings of the same slug share one tag, which keeps its first name', async () => {
    await createRecipe('Sopa rápida', ['rápido', 'RÁPIDO'])
    const rapidos = (await myTags()).filter((t) => t.slug === 'rpido')
    expect(rapidos).toEqual([expect.objectContaining({ name: 'Rápido', usageCount: 2 })])
  })

  it('a tag with no usable characters stays on the recipe but is not registered', async () => {
    const r = await createRecipe('Ñoquis', ['ñ', 'pasta'])
    expect(await recipeTags(r.id)).toEqual(['ñ', 'pasta'])
    expect((await myTags()).map((t) => t.slug)).not.toContain('')
    expect(await tagNamed('pasta')).toMatchObject({ usageCount: 1 })
  })

  it('editing the tags moves the counts; an edit without tags leaves them alone', async () => {
    const r = await createRecipe('Guiso', ['invierno'])
    expect(await tagNamed('invierno')).toMatchObject({ usageCount: 1 })
    const put = await app.request(`/v1/recipes/${r.id}`, {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify({ tags: ['otoño', 'casero'] }),
    })
    expect(put.status).toBe(200)
    expect(await tagNamed('invierno')).toMatchObject({ usageCount: 0, isDeletable: true })
    expect(await tagNamed('otoño')).toMatchObject({ usageCount: 1 })
    expect(await tagNamed('casero')).toMatchObject({ usageCount: 1 })

    const titleOnly = await app.request(`/v1/recipes/${r.id}`, {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify({ title: 'Guiso de lentejas' }),
    })
    expect(titleOnly.status).toBe(200)
    expect(await tagNamed('casero')).toMatchObject({ usageCount: 1 })

    const cleared = await app.request(`/v1/recipes/${r.id}`, {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify({ tags: [] }),
    })
    expect(cleared.status).toBe(200)
    expect(await tagNamed('casero')).toMatchObject({ usageCount: 0 })
    await app.request(`/v1/recipes/${r.id}`, {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify({ tags: ['otoño', 'casero'] }),
    })
  })

  it('each owner has their own registry', async () => {
    await createRecipe('Pizza ajena', ['Rápido'], otherAuth)
    expect(await tagNamed('Rápido')).toMatchObject({ usageCount: 2 })
    expect(await tagNamed('Rápido', otherAuth)).toMatchObject({ usageCount: 1 })
  })

  it('renaming a tag renames it on every recipe, and search follows', async () => {
    const r = await createRecipe('Budín', ['dulce', 'Casero'])
    const dulce = await tagNamed('dulce')
    const res = await app.request(`/v1/config/tags/${dulce!.id}`, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ name: 'Dulces' }),
    })
    expect(res.status).toBe(200)
    expect(await recipeTags(r.id)).toEqual(['Dulces', 'Casero'])
    expect(await titlesWithTag('Dulces')).toEqual(['Budín'])
    expect(await titlesWithTag('dulce')).toEqual([])
    expect(await tagNamed('Dulces')).toMatchObject({ usageCount: 1 })
  })

  it("renaming someone else's tag changes nothing", async () => {
    const theirs = await tagNamed('Rápido', otherAuth)
    const res = await app.request(`/v1/config/tags/${theirs!.id}`, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ name: 'Hackeado' }),
    })
    expect(res.status).toBe(404)
    expect(await tagNamed('Rápido', otherAuth)).toBeDefined()
  })

  it('an unused tag can be renamed and deleted without touching any recipe', async () => {
    const created = await app.request('/v1/config/tags', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ name: 'suelta' }),
    })
    const { id } = (await created.json()) as { id: string }
    const renamed = await app.request(`/v1/config/tags/${id}`, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ name: 'Suelta2' }),
    })
    expect(await renamed.json()).toEqual({ id, name: 'Suelta2' })
    const del = await app.request(`/v1/config/tags/${id}`, { method: 'DELETE', headers: auth })
    expect(del.status).toBe(204)
    expect(await tagNamed('Suelta2')).toBeUndefined()
  })

  it('deleting a tag removes it from its recipes', async () => {
    const r = await createRecipe('Flan', ['postre-frio', 'Casero'])
    const tag = await tagNamed('postre-frio')
    const res = await app.request(`/v1/config/tags/${tag!.id}`, {
      method: 'DELETE',
      headers: auth,
    })
    expect(res.status).toBe(204)
    expect(await recipeTags(r.id)).toEqual(['Casero'])
    expect(await tagNamed('postre-frio')).toBeUndefined()
  })

  it('merging moves the recipes to the target name, without duplicates', async () => {
    const a = await createRecipe('Wok', ['rapidito', 'veloz'])
    const b = await createRecipe('Omelette', ['veloz'])
    const source = await tagNamed('veloz')
    const target = await tagNamed('rapidito')
    const res = await app.request('/v1/config/tags/merge', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ sourceId: source!.id, targetId: target!.id }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ merged: 2 })
    expect(await recipeTags(a.id)).toEqual(['rapidito'])
    expect(await recipeTags(b.id)).toEqual(['rapidito'])
    expect(await tagNamed('rapidito')).toMatchObject({ usageCount: 2 })
    expect(await tagNamed('veloz')).toBeUndefined()
    expect(await titlesWithTag('rapidito')).toEqual(['Omelette', 'Wok'])
  })

  it('merging an unused tag moves nothing', async () => {
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
    const res = await app.request('/v1/config/tags/merge', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ sourceId: await mk('vacia-a'), targetId: await mk('vacia-b') }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ merged: 0 })
    expect(await tagNamed('vacia-a')).toBeUndefined()
  })

  it('deleting with reassignment renames the tag on its recipes', async () => {
    const r = await createRecipe('Ensalada', ['fresco'])
    await createRecipe('Gazpacho', ['verano'])
    const from = await tagNamed('fresco')
    const to = await tagNamed('verano')
    const res = await app.request(`/v1/config/tags/${from!.id}?reassignTo=${to!.id}`, {
      method: 'DELETE',
      headers: auth,
    })
    expect(res.status).toBe(204)
    expect(await recipeTags(r.id)).toEqual(['verano'])
    expect(await tagNamed('verano')).toMatchObject({ usageCount: 2 })
  })

  it("a copied recipe's tags join the copier's registry", async () => {
    const res = await app.request('/v1/recipes', {
      method: 'POST',
      headers: otherAuth,
      body: JSON.stringify({
        title: 'Receta pública',
        servings: 1,
        category: 'Cena',
        tags: ['compartida'],
        visibility: 'public',
        ingredients: [{ name: 'sal', quantity: 1, unit: 'g' }],
        steps: [{ text: 'Paso.' }],
      }),
    })
    const pub = (await res.json()) as { id: string }
    const copy = await app.request(`/v1/recipes/${pub.id}/copy`, { method: 'POST', headers: auth })
    expect(copy.status).toBe(201)
    expect(await tagNamed('compartida')).toMatchObject({ usageCount: 1 })
    expect(await tagNamed('compartida', otherAuth)).toMatchObject({ usageCount: 1 })
  })

  it('deleting a recipe frees its tags', async () => {
    const r = await createRecipe('Efímera', ['temporal'])
    await app.request(`/v1/recipes/${r.id}`, { method: 'DELETE', headers: auth })
    expect(await tagNamed('temporal')).toMatchObject({ usageCount: 0, isDeletable: true })
  })

  it('the release backfill links recipes saved before tags were linked, once', async () => {
    const db = getDb()
    const [legacy] = await db
      .insert(schema.recipes)
      .values({
        ownerId: TEST_OWNER_ID,
        title: 'Vieja',
        servings: 1,
        category: 'Cena',
        tags: ['legado', 'Casero'],
      })
      .returning()
    await db.insert(schema.recipes).values({
      ownerId: TEST_OWNER_ID,
      title: 'Sin tags',
      servings: 1,
      category: 'Cena',
      tags: [],
    })
    expect(await tagNamed('legado')).toBeUndefined()

    expect(await backfillRecipeTags()).toBe(1)
    expect(await tagNamed('legado')).toMatchObject({ usageCount: 1 })
    // 'casero' was first registered lowercase (the Guiso test), so 'Casero' joins it
    const casero = (await myTags()).find((t) => t.slug === 'casero')
    const links = await db
      .select()
      .from(schema.recipeTags)
      .where(eq(schema.recipeTags.recipeId, legacy!.id))
    expect(links.map((l) => l.tagId)).toContain(casero!.id)
    expect(await backfillRecipeTags()).toBe(0)
  })
})
