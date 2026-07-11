import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'

vi.mock('../db/ingredient-repository.js', () => {
  const mockRepo = {
    listCanonicals: vi.fn(),
    listUnmatchedIngredients: vi.fn(),
    createCanonical: vi.fn(),
    getCanonicalById: vi.fn(),
    findCanonicalByName: vi.fn(),
    findOrCreateFamily: vi.fn(),
    setSynonym: vi.fn(),
    deleteCanonical: vi.fn(),
    deleteSynonym: vi.fn(),
  }
  return { ingredientRepository: mockRepo, IngredientRepository: vi.fn(() => mockRepo) }
})

// Make getDb throw so the auth middleware falls back to DEV_API_KEY (matches the
// other route unit tests, and keeps these green under the integration config too).
vi.mock('../db/index.js', () => ({
  getDb: vi.fn(() => {
    throw new Error('DB not available in tests')
  }),
  schema: {},
}))

import { app } from '../index.js'
import { ingredientRepository } from '../db/ingredient-repository.js'

const mockRepo = ingredientRepository as unknown as {
  listCanonicals: ReturnType<typeof vi.fn>
  listUnmatchedIngredients: ReturnType<typeof vi.fn>
  createCanonical: ReturnType<typeof vi.fn>
  getCanonicalById: ReturnType<typeof vi.fn>
  findCanonicalByName: ReturnType<typeof vi.fn>
  findOrCreateFamily: ReturnType<typeof vi.fn>
  setSynonym: ReturnType<typeof vi.fn>
  deleteCanonical: ReturnType<typeof vi.fn>
  deleteSynonym: ReturnType<typeof vi.fn>
}

const DEV_KEY = 'ingredients-test-key'
const AUTH = { Authorization: `Bearer ${DEV_KEY}` }
const JSON_AUTH = { ...AUTH, 'Content-Type': 'application/json' }
const CANON_ID = '550e8400-e29b-41d4-a716-446655440000'

beforeAll(() => {
  process.env['DEV_API_KEY'] = DEV_KEY
})
afterAll(() => {
  delete process.env['DEV_API_KEY']
})
beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /v1/ingredients', () => {
  it('returns the canonical list', async () => {
    mockRepo.listCanonicals.mockResolvedValue([
      {
        id: CANON_ID,
        name: 'Pollo',
        normalizedName: 'pollo',
        familyId: null,
        familyName: 'pollo',
        isSystem: true,
        synonyms: [],
      },
    ])
    const res = await app.request('/v1/ingredients', { headers: AUTH })
    expect(res.status).toBe(200)
    expect((await res.json())[0].name).toBe('Pollo')
  })

  it('requires auth', async () => {
    const res = await app.request('/v1/ingredients')
    expect(res.status).toBe(401)
  })
})

describe('GET /v1/ingredients/unmatched', () => {
  it('returns the caller unmatched ingredient list', async () => {
    mockRepo.listUnmatchedIngredients.mockResolvedValue([
      { name: 'suprema de pollo', normalized: 'suprema de pollo', count: 2 },
    ])
    const res = await app.request('/v1/ingredients/unmatched', { headers: AUTH })
    expect(res.status).toBe(200)
    expect((await res.json())[0].count).toBe(2)
  })
})

describe('POST /v1/ingredients/canonical', () => {
  it('creates a canonical', async () => {
    mockRepo.createCanonical.mockResolvedValue({
      id: CANON_ID,
      name: 'Kale',
      normalizedName: 'kale',
    })
    const res = await app.request('/v1/ingredients/canonical', {
      method: 'POST',
      headers: JSON_AUTH,
      body: JSON.stringify({ name: 'Kale' }),
    })
    expect(res.status).toBe(200)
    expect((await res.json()).normalizedName).toBe('kale')
    expect(mockRepo.createCanonical).toHaveBeenCalledWith('Kale', null)
  })

  it('resolves familyName to an id when creating', async () => {
    mockRepo.findOrCreateFamily.mockResolvedValue('fam-1')
    mockRepo.createCanonical.mockResolvedValue({
      id: CANON_ID,
      name: 'Muslo de pollo',
      normalizedName: 'muslo de pollo',
    })
    const res = await app.request('/v1/ingredients/canonical', {
      method: 'POST',
      headers: JSON_AUTH,
      body: JSON.stringify({ name: 'Muslo de pollo', familyName: 'pollo' }),
    })
    expect(res.status).toBe(200)
    expect(mockRepo.findOrCreateFamily).toHaveBeenCalledWith('pollo')
    expect(mockRepo.createCanonical).toHaveBeenCalledWith('Muslo de pollo', 'fam-1')
  })

  it('rejects an empty name (400)', async () => {
    const res = await app.request('/v1/ingredients/canonical', {
      method: 'POST',
      headers: JSON_AUTH,
      body: JSON.stringify({ name: '' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('POST /v1/ingredients/synonym', () => {
  it('maps a synonym to a canonical by id', async () => {
    mockRepo.getCanonicalById.mockResolvedValue({ id: CANON_ID, name: 'Kale' })
    mockRepo.setSynonym.mockResolvedValue({ id: 'syn-1', synonym: 'col rizada' })
    const res = await app.request('/v1/ingredients/synonym', {
      method: 'POST',
      headers: JSON_AUTH,
      body: JSON.stringify({ surface: 'Col rizada', canonicalId: CANON_ID }),
    })
    expect(res.status).toBe(200)
    expect((await res.json()).synonym).toBe('col rizada')
  })

  it('maps a synonym to a canonical by name', async () => {
    mockRepo.findCanonicalByName.mockResolvedValue({ id: CANON_ID })
    mockRepo.setSynonym.mockResolvedValue({ id: 'syn-2', synonym: 'suprema de pollo' })
    const res = await app.request('/v1/ingredients/synonym', {
      method: 'POST',
      headers: JSON_AUTH,
      body: JSON.stringify({ surface: 'Suprema de pollo', canonicalName: 'Pollo' }),
    })
    expect(res.status).toBe(200)
    expect(mockRepo.findCanonicalByName).toHaveBeenCalledWith('Pollo')
    expect(mockRepo.setSynonym).toHaveBeenCalledWith('Suprema de pollo', CANON_ID)
  })

  it('400s when neither canonicalId nor canonicalName is given', async () => {
    const res = await app.request('/v1/ingredients/synonym', {
      method: 'POST',
      headers: JSON_AUTH,
      body: JSON.stringify({ surface: 'x' }),
    })
    expect(res.status).toBe(400)
  })

  it('404s when the canonical name does not resolve', async () => {
    mockRepo.findCanonicalByName.mockResolvedValue(null)
    const res = await app.request('/v1/ingredients/synonym', {
      method: 'POST',
      headers: JSON_AUTH,
      body: JSON.stringify({ surface: 'x', canonicalName: 'Nope' }),
    })
    expect(res.status).toBe(404)
  })

  it('404s when the canonical id does not exist', async () => {
    mockRepo.getCanonicalById.mockResolvedValue(null)
    const res = await app.request('/v1/ingredients/synonym', {
      method: 'POST',
      headers: JSON_AUTH,
      body: JSON.stringify({ surface: 'x', canonicalId: CANON_ID }),
    })
    expect(res.status).toBe(404)
  })

  it('400s when the surface normalizes to empty', async () => {
    mockRepo.getCanonicalById.mockResolvedValue({ id: CANON_ID })
    mockRepo.setSynonym.mockResolvedValue(null)
    const res = await app.request('/v1/ingredients/synonym', {
      method: 'POST',
      headers: JSON_AUTH,
      body: JSON.stringify({ surface: 'picado', canonicalId: CANON_ID }),
    })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /v1/ingredients/canonical/{id}', () => {
  it('deletes a non-system canonical (204)', async () => {
    mockRepo.deleteCanonical.mockResolvedValue(true)
    const res = await app.request(`/v1/ingredients/canonical/${CANON_ID}`, {
      method: 'DELETE',
      headers: AUTH,
    })
    expect(res.status).toBe(204)
  })

  it('404s for a system/missing canonical', async () => {
    mockRepo.deleteCanonical.mockResolvedValue(false)
    const res = await app.request(`/v1/ingredients/canonical/${CANON_ID}`, {
      method: 'DELETE',
      headers: AUTH,
    })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /v1/ingredients/synonym/{id}', () => {
  it('deletes a non-system synonym (204)', async () => {
    mockRepo.deleteSynonym.mockResolvedValue(true)
    const res = await app.request(`/v1/ingredients/synonym/${CANON_ID}`, {
      method: 'DELETE',
      headers: AUTH,
    })
    expect(res.status).toBe(204)
  })

  it('404s for a system/missing synonym', async () => {
    mockRepo.deleteSynonym.mockResolvedValue(false)
    const res = await app.request(`/v1/ingredients/synonym/${CANON_ID}`, {
      method: 'DELETE',
      headers: AUTH,
    })
    expect(res.status).toBe(404)
  })
})
