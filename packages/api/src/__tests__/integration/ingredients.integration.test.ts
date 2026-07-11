import { describe, it, expect, beforeAll } from 'vitest'

const skip = process.env['SKIP_INTEGRATION'] === 'true'
import app from '../../index.js'
import { TEST_API_KEY, resetTestDb } from './globalSetup.js'

const auth = `Bearer ${TEST_API_KEY}`
const headers = { Authorization: auth, 'Content-Type': 'application/json' }

type Canonical = {
  id: string
  name: string
  familyName: string | null
  isSystem: boolean
  synonyms: { id: string; synonym: string; isSystem: boolean }[]
}

async function list(): Promise<Canonical[]> {
  const res = await app.request('/v1/ingredients', { headers: { Authorization: auth } })
  return (await res.json()) as Canonical[]
}

describe.skipIf(skip).sequential('Ingredient unification integration', () => {
  beforeAll(async () => {
    await resetTestDb() // reseeds the es-AR ingredient data
  })

  it('GET /v1/ingredients returns seeded canonicals with their synonyms and family', async () => {
    const canon = await list()
    const pollo = canon.find((c) => c.name === 'Pollo')
    expect(pollo).toBeDefined()
    expect(pollo!.familyName).toBe('pollo')
    expect(pollo!.isSystem).toBe(true)
    const synonyms = pollo!.synonyms.map((s) => s.synonym)
    expect(synonyms).toContain('pechuga')
    expect(synonyms).toContain('suprema de pollo')
    // muslo is a separate canonical in the same family, not a synonym of pollo
    expect(canon.some((c) => c.name === 'Muslo de pollo' && c.familyName === 'pollo')).toBe(true)
  })

  it('loadCanonicalMaps resolves synonyms, presentations and passthrough', async () => {
    const { ingredientRepository } = await import('../../db/ingredient-repository.js')
    const { resolveCanonical } = await import('@recetario/shared')
    const maps = await ingredientRepository.loadCanonicalMaps()

    expect(resolveCanonical('Suprema de pollo', maps.synonyms, maps.canonicals).key).toBe('pollo')
    expect(resolveCanonical('Pechugas', maps.synonyms, maps.canonicals).key).toBe('pollo')
    expect(resolveCanonical('pollo picado', maps.synonyms, maps.canonicals).key).toBe('pollo')
    // culinarily distinct cut stays separate
    expect(resolveCanonical('Muslo de pollo', maps.synonyms, maps.canonicals).key).toBe(
      'muslo de pollo',
    )
    // allergen case + regional synonym
    expect(resolveCanonical('Cacahuate', maps.synonyms, maps.canonicals).key).toBe('mani')
    // unknown passes through
    const unknown = resolveCanonical('Alga nori', maps.synonyms, maps.canonicals)
    expect(unknown.key).toBe('alga nori')
    expect(unknown.matched).toBe(false)
  })

  it('creates a canonical + synonym, resolves it, then deletes both', async () => {
    const created = (await (
      await app.request('/v1/ingredients/canonical', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Kale' }),
      })
    ).json()) as { id: string; normalizedName: string }
    expect(created.normalizedName).toBe('kale')

    const syn = (await (
      await app.request('/v1/ingredients/synonym', {
        method: 'POST',
        headers,
        body: JSON.stringify({ surface: 'Col rizada', canonicalId: created.id }),
      })
    ).json()) as { id: string; synonym: string }
    expect(syn.synonym).toBe('col rizada')

    const { ingredientRepository } = await import('../../db/ingredient-repository.js')
    const { resolveCanonical } = await import('@recetario/shared')
    const maps = await ingredientRepository.loadCanonicalMaps()
    expect(resolveCanonical('col rizada', maps.synonyms, maps.canonicals).key).toBe('kale')

    const delSyn = await app.request(`/v1/ingredients/synonym/${syn.id}`, {
      method: 'DELETE',
      headers,
    })
    expect(delSyn.status).toBe(204)
    const delCanon = await app.request(`/v1/ingredients/canonical/${created.id}`, {
      method: 'DELETE',
      headers,
    })
    expect(delCanon.status).toBe(204)
  })

  it('createCanonical is idempotent — a second create returns the existing row', async () => {
    const { ingredientRepository } = await import('../../db/ingredient-repository.js')
    const first = await ingredientRepository.createCanonical('Espárrago', null)
    const second = await ingredientRepository.createCanonical('Espárrago', null)
    expect(second.id).toBe(first.id)
    expect(second.normalizedName).toBe('esparrago')
    await ingredientRepository.deleteCanonical(first.id)
  })

  it('protects system canonicals and synonyms from deletion (404)', async () => {
    const canon = await list()
    const pollo = canon.find((c) => c.name === 'Pollo')!
    const resCanon = await app.request(`/v1/ingredients/canonical/${pollo.id}`, {
      method: 'DELETE',
      headers,
    })
    expect(resCanon.status).toBe(404)
    const resSyn = await app.request(`/v1/ingredients/synonym/${pollo.synonyms[0]!.id}`, {
      method: 'DELETE',
      headers,
    })
    expect(resSyn.status).toBe(404)
  })

  it('404s when deleting a canonical or synonym that does not exist', async () => {
    const missing = '11111111-1111-4111-8111-111111111111'
    const resCanon = await app.request(`/v1/ingredients/canonical/${missing}`, {
      method: 'DELETE',
      headers,
    })
    expect(resCanon.status).toBe(404)
    const resSyn = await app.request(`/v1/ingredients/synonym/${missing}`, {
      method: 'DELETE',
      headers,
    })
    expect(resSyn.status).toBe(404)
  })

  it('rejects a synonym surface that normalizes to empty (400) and a missing canonical (404)', async () => {
    const canon = await list()
    const pollo = canon.find((c) => c.name === 'Pollo')!
    const empty = await app.request('/v1/ingredients/synonym', {
      method: 'POST',
      headers,
      body: JSON.stringify({ surface: 'picado', canonicalId: pollo.id }),
    })
    expect(empty.status).toBe(400)

    const missing = await app.request('/v1/ingredients/synonym', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        surface: 'cosa',
        canonicalId: '00000000-0000-0000-0000-000000000000',
      }),
    })
    expect(missing.status).toBe(404)
  })

  it('seedIngredients is idempotent (a second run adds nothing)', async () => {
    const { seedIngredients } = await import('../../db/seed-ingredients.js')
    const { getDb, schema } = await import('../../db/index.js')
    const db = getDb()
    const countCanon = async () => (await db.select().from(schema.canonicalIngredients)).length
    const before = await countCanon()
    await seedIngredients(db)
    expect(await countCanon()).toBe(before)
  })
})
