import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockUsersUpdate, mockProfileSelect, mockProfileUpsert, mockProfileValues } = vi.hoisted(
  () => ({
    mockUsersUpdate: vi.fn(),
    mockProfileSelect: vi.fn(),
    mockProfileUpsert: vi.fn(),
    mockProfileValues: vi.fn(),
  }),
)

vi.mock('../db/index.js', () => ({
  getDb: vi.fn(() => ({
    update: () => ({
      set: () => ({ where: () => ({ returning: () => Promise.resolve(mockUsersUpdate()) }) }),
    }),
    select: () => ({
      from: () => ({ where: () => ({ limit: () => Promise.resolve(mockProfileSelect()) }) }),
    }),
    insert: () => ({
      values: (v: unknown) => ({
        onConflictDoUpdate: () => Promise.resolve(mockProfileUpsert(mockProfileValues(v))),
        onConflictDoNothing: () => Promise.resolve(),
      }),
    }),
  })),
  schema: { users: {}, userProfiles: { userId: 'user_id' } },
}))

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
    mockUsersUpdate.mockReturnValue([
      {
        id: 'u1',
        email: 'a@a.com',
        displayName: 'New Name',
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
    const res = await app.request('/auth/me', {
      method: 'PATCH',
      headers: AUTH,
      body: JSON.stringify({ displayName: 'New Name' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.displayName).toBe('New Name')
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
    mockUsersUpdate.mockReturnValue([])
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
    mockProfileSelect.mockReturnValue([
      {
        userId: 'u1',
        preferredServings: 3,
        dietaryRestrictions: ['vegano'],
        allergens: [],
        goals: [],
        timezone: 'America/Argentina/Buenos_Aires',
      },
    ])
    const res = await app.request('/auth/profile', {
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.preferredServings).toBe(3)
    expect(body.dietaryRestrictions).toEqual(['vegano'])
  })

  it('returns 404 when profile not found', async () => {
    mockProfileSelect.mockReturnValue([])
    const res = await app.request('/auth/profile', {
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(404)
  })
})

describe('GET /auth/profile null branch', () => {
  it('handles null profile fields gracefully', async () => {
    mockProfileSelect.mockReturnValue([
      {
        userId: 'u1',
        preferredServings: null,
        dietaryRestrictions: null,
        allergens: null,
        goals: null,
        timezone: null,
      },
    ])
    const res = await app.request('/auth/profile', {
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.dietaryRestrictions).toEqual([])
  })
})

describe('PATCH /auth/profile', () => {
  it('accepts an IANA time zone and rejects an unknown one', async () => {
    mockProfileUpsert.mockReturnValue([])
    mockProfileSelect.mockReturnValue([
      {
        userId: 'u1',
        preferredServings: 2,
        dietaryRestrictions: [],
        allergens: [],
        goals: [],
        timezone: 'America/Montevideo',
      },
    ])
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

  it('upserts profile and returns updated data', async () => {
    mockProfileUpsert.mockReturnValue([])
    mockProfileSelect.mockReturnValue([
      {
        userId: 'u1',
        preferredServings: 4,
        dietaryRestrictions: ['keto'],
        allergens: ['maní', 'kiwi'],
        goals: [],
        timezone: null,
      },
    ])
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
    // Stored as deduplicated enum keys
    expect(mockProfileValues).toHaveBeenLastCalledWith(
      expect.objectContaining({ allergens: ['mani', 'leche'] }),
    )
    const body = await res.json()
    expect(body.preferredServings).toBe(4)
    // Legacy stored names are returned as keys; unknown legacy text is kept
    expect(body.allergens).toEqual(['mani', 'kiwi'])
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

  it('returns null fields when profile not found after upsert', async () => {
    mockProfileUpsert.mockReturnValue([])
    mockProfileSelect.mockReturnValue([]) // empty after upsert
    const res = await app.request('/auth/profile', {
      method: 'PATCH',
      headers: AUTH,
      body: JSON.stringify({ timezone: 'UTC' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.preferredServings).toBeNull()
    expect(body.dietaryRestrictions).toEqual([])
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
