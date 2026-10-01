import { describe, it, expect, vi, beforeEach } from 'vitest'

const { account } = vi.hoisted(() => ({
  account: {
    updateUser: vi.fn(),
    findProfile: vi.fn(),
    upsertProfile: vi.fn(),
  },
}))

// No database: the API-key lookup fails and DEV_API_KEY authenticates as 'dev'
vi.mock('../db/index.js', () => ({
  getDb: () => {
    throw new Error('no database in unit tests')
  },
  schema: new Proxy({}, { get: () => ({}) }),
}))
vi.mock('../db/account-repository.js', () => ({ accountRepository: account }))

const PROFILE = {
  preferredServings: 2,
  dietaryRestrictions: [],
  allergens: [],
  goals: [],
  timezone: null,
  nutritionTargets: null,
}

vi.mock('../db/repository.js', () => ({
  recipeRepository: {
    list: vi.fn().mockResolvedValue([]),
    search: vi.fn().mockResolvedValue([]),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
  },
}))
vi.mock('../db/menu-repository.js', () => ({
  menuRepository: {
    getWeek: vi.fn().mockResolvedValue([]),
    upsert: vi.fn(),
    remove: vi.fn(),
    getScaledIngredients: vi.fn().mockResolvedValue([]),
  },
}))

import { app } from '../index.js'
import { requests as rateLimitStore } from '../middleware/rateLimit.js'

const AUTH = { Authorization: 'Bearer test-key', 'Content-Type': 'application/json' }

beforeEach(() => {
  process.env['DEV_API_KEY'] = 'test-key'
  rateLimitStore.clear()
})

describe('PATCH /auth/me', () => {
  it('updates user display name', async () => {
    account.updateUser.mockResolvedValue({
      id: 'u1',
      email: 'a@a.com',
      displayName: 'New Name',
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const res = await app.request('/auth/me', {
      method: 'PATCH',
      headers: AUTH,
      body: JSON.stringify({ displayName: 'New Name' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.displayName).toBe('New Name')
    expect(account.updateUser).toHaveBeenLastCalledWith('dev', { displayName: 'New Name' })
  })

  it('returns 400 for a non-http(s) avatarUrl', async () => {
    const res = await app.request('/auth/me', {
      method: 'PATCH',
      headers: AUTH,
      body: JSON.stringify({ avatarUrl: 'javascript:alert(1)' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 404 when user not found', async () => {
    account.updateUser.mockResolvedValue(null)
    const res = await app.request('/auth/me', {
      method: 'PATCH',
      headers: AUTH,
      body: JSON.stringify({ displayName: 'X' }),
    })
    expect(res.status).toBe(404)
  })
})

describe('GET /auth/profile', () => {
  it('returns profile data', async () => {
    account.findProfile.mockResolvedValue({
      ...PROFILE,
      preferredServings: 3,
      dietaryRestrictions: ['vegano'],
    })
    const res = await app.request('/auth/profile', {
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.preferredServings).toBe(3)
    expect(body.dietaryRestrictions).toEqual(['vegano'])
  })

  it('returns 404 when profile not found', async () => {
    account.findProfile.mockResolvedValue(null)
    const res = await app.request('/auth/profile', {
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(404)
  })
})

describe('PATCH /auth/profile', () => {
  it('accepts an IANA time zone and rejects an unknown one', async () => {
    account.upsertProfile.mockResolvedValue({ ...PROFILE, timezone: 'America/Montevideo' })
    const ok = await app.request('/auth/profile', {
      method: 'PATCH',
      headers: AUTH,
      body: JSON.stringify({ timezone: 'America/Montevideo' }),
    })
    expect(ok.status).toBe(200)
    expect((await ok.json()).timezone).toBe('America/Montevideo')

    const bad = await app.request('/auth/profile', {
      method: 'PATCH',
      headers: AUTH,
      body: JSON.stringify({ timezone: 'Mars/Olympus' }),
    })
    expect(bad.status).toBe(400)
  })

  it('stores allergens as deduplicated keys and returns the stored profile', async () => {
    account.upsertProfile.mockResolvedValue({
      ...PROFILE,
      preferredServings: 4,
      dietaryRestrictions: ['keto'],
      allergens: ['mani', 'leche'],
    })
    const res = await app.request('/auth/profile', {
      method: 'PATCH',
      headers: AUTH,
      body: JSON.stringify({
        preferredServings: 4,
        dietaryRestrictions: ['keto'],
        allergens: ['maní', 'mani', 'Lácteos'],
      }),
    })
    expect(res.status).toBe(200)
    expect(account.upsertProfile).toHaveBeenLastCalledWith(
      'dev',
      expect.objectContaining({ allergens: ['mani', 'leche'] }),
    )
    const body = await res.json()
    expect(body.preferredServings).toBe(4)
  })

  it('rejects an allergen outside the enum with a 400 listing the valid keys', async () => {
    const res = await app.request('/auth/profile', {
      method: 'PATCH',
      headers: AUTH,
      body: JSON.stringify({ allergens: ['leche', 'kiwi'] }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Unknown allergen: kiwi')
    expect(body.error).toContain('frutos_secos')
  })

  it('rejects invalid dietary restriction values', async () => {
    const res = await app.request('/auth/profile', {
      method: 'PATCH',
      headers: AUTH,
      body: JSON.stringify({ dietaryRestrictions: ['carnivore'] }),
    })
    expect(res.status).toBe(400)
  })
})
