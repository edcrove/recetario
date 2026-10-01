import { describe, it, expect, beforeAll } from 'vitest'

const skip = process.env['SKIP_INTEGRATION'] === 'true'
import app from '../../index.js'
import { TEST_API_KEY, resetTestDb } from './globalSetup.js'

const headers = { Authorization: `Bearer ${TEST_API_KEY}`, 'Content-Type': 'application/json' }
const recipe = {
  title: 'Integridad de escritura',
  servings: 2,
  category: 'Cena',
  ingredients: [{ name: 'sal', quantity: 1, unit: 'g' }],
  steps: [{ text: 'Paso.' }],
}

// Write integrity and the JSON error contract (audit 2026-10-01): a failed write
// leaves nothing behind, and every error is JSON with an `error` field.
describe.skipIf(skip).sequential('API errors and write integrity', () => {
  beforeAll(async () => {
    await resetTestDb()
  })

  it('an unknown foodTypeId is a 400 and creates no recipe (no orphan)', async () => {
    const title = `Huérfana ${Date.now()}`
    const res = await app.request('/v1/recipes', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...recipe,
        title,
        foodTypeIds: ['00000000-0000-4000-8000-000000000000'],
      }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Unknown foodTypeIds' })

    const search = await app.request(`/v1/recipes/search?q=${encodeURIComponent(title)}`, {
      headers,
    })
    expect(await search.json()).toEqual([])
  })

  it('a failing update rolls back every change in it', async () => {
    const created = await app.request('/v1/recipes', {
      method: 'POST',
      headers,
      body: JSON.stringify(recipe),
    })
    const { id } = (await created.json()) as { id: string }
    const res = await app.request(`/v1/recipes/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        title: 'No debería quedar',
        steps: [{ text: 'Tampoco esto.' }],
        foodTypeIds: ['00000000-0000-4000-8000-000000000000'],
      }),
    })
    expect(res.status).toBe(400)
    const after = (await (await app.request(`/v1/recipes/${id}`, { headers })).json()) as {
      title: string
      steps: Array<{ text: string }>
    }
    expect(after.title).toBe(recipe.title)
    expect(after.steps.map((s) => s.text)).toEqual(['Paso.'])
  })

  it('a system synonym cannot be remapped (409) and keeps pointing where it did', async () => {
    const list = (await (await app.request('/v1/ingredients', { headers })).json()) as Array<{
      id: string
      name: string
      synonyms: Array<{ synonym: string; isSystem: boolean }>
    }>
    const owner = list.find((c) => c.synonyms.some((s) => s.isSystem))!
    const systemSyn = owner.synonyms.find((s) => s.isSystem)!.synonym
    const other = list.find((c) => c.id !== owner.id)!

    const res = await app.request('/v1/ingredients/synonym', {
      method: 'POST',
      headers,
      body: JSON.stringify({ surface: systemSyn, canonicalId: other.id }),
    })
    expect(res.status).toBe(409)

    const again = (await (await app.request('/v1/ingredients', { headers })).json()) as typeof list
    expect(again.find((c) => c.id === owner.id)!.synonyms.map((s) => s.synonym)).toContain(
      systemSyn,
    )
  })

  it('a dangling reference is a 400 JSON error, not a plain-text 500', async () => {
    const res = await app.request('/v1/cook-sessions', {
      method: 'POST',
      headers,
      body: JSON.stringify({ recipeId: '00000000-0000-4000-8000-000000000000' }),
    })
    expect([400, 404]).toContain(res.status)
    expect(res.headers.get('content-type')).toMatch(/json/)
  })

  it('impossible dates and malformed JSON are 400s with the shared JSON shape', async () => {
    const bad = await app.request('/v1/cook-sessions/stats?since=2026-13-45', { headers })
    expect(bad.status).toBe(400)
    expect(await bad.json()).toMatchObject({ error: 'Validation error' })

    const malformed = await app.request('/v1/recipes', {
      method: 'POST',
      headers,
      body: '{not json',
    })
    expect(malformed.status).toBe(400)
    expect((await malformed.json()).error).toMatch(/JSON/i)
  })

  it('unknown routes are JSON 404s, also under /v1', async () => {
    const res = await app.request('/v1/does-not-exist', { headers })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Not found' })
  })
})
