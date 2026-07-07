import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockInsert, mockSelect, mockUpdate, mockDelete } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}))

vi.mock('../db/index.js', () => ({
  getDb: vi.fn(() => ({
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve(mockInsert()),
        onConflictDoNothing: () => ({ returning: () => Promise.resolve(mockInsert()) }),
      }),
    }),
    select: () => ({
      from: () => ({
        innerJoin: () => ({ where: () => Promise.resolve(mockSelect()) }),
        where: () => ({
          limit: () => Promise.resolve(mockSelect()),
          where: () => Promise.resolve(mockSelect()),
        }),
      }),
    }),
    update: () => ({
      set: () => ({ where: () => ({ returning: () => Promise.resolve(mockUpdate()) }) }),
    }),
    delete: () => ({ where: () => ({ returning: () => Promise.resolve(mockDelete()) }) }),
  })),
  schema: {
    households: {},
    householdMembers: { householdId: 'hh', userId: 'uid', role: 'role' },
    users: { email: 'email' },
  },
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
const HH_ID = '550e8400-e29b-41d4-a716-446655440000'
const USER_ID = '550e8400-e29b-41d4-a716-446655440001'

beforeEach(() => {
  process.env['DEV_API_KEY'] = 'test-key'
  rateLimitStore.clear()
  mockInsert.mockReset()
  mockSelect.mockReset()
  mockUpdate.mockReset()
  mockDelete.mockReset()
})

const makeHousehold = () => ({
  id: HH_ID,
  name: 'Mi Hogar',
  ownerId: 'dev',
  createdAt: new Date(),
})

const makeMember = (role = 'owner') => ({
  householdId: HH_ID,
  userId: 'dev',
  role,
  invitedAt: new Date(),
  acceptedAt: new Date(),
})

describe('POST /v1/households', () => {
  it('creates household and returns 201', async () => {
    mockInsert.mockReturnValueOnce([makeHousehold()]).mockReturnValueOnce([makeMember()])
    const res = await app.request('/v1/households', {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ name: 'Mi Hogar' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('Mi Hogar')
  })
})

describe('GET /v1/households/mine', () => {
  it('returns empty list when user has no households', async () => {
    mockSelect.mockReturnValue([])
    const res = await app.request('/v1/households/mine', {
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })
})

describe('POST /v1/households/:id/invite', () => {
  it('returns 404 when user is not a member of the household', async () => {
    mockSelect.mockReturnValue([])
    const res = await app.request(`/v1/households/${HH_ID}/invite`, {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ userId: USER_ID, role: 'member' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 403 when user is a viewer (not owner/admin)', async () => {
    mockSelect.mockReturnValue([makeMember('viewer')])
    const res = await app.request(`/v1/households/${HH_ID}/invite`, {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ userId: USER_ID, role: 'member' }),
    })
    expect(res.status).toBe(403)
  })

  it('invites a new member when requester is owner', async () => {
    mockSelect.mockReturnValue([makeMember('owner')])
    mockInsert.mockReturnValue([
      {
        householdId: HH_ID,
        userId: USER_ID,
        role: 'member',
        invitedAt: new Date(),
        acceptedAt: null,
      },
    ])
    const res = await app.request(`/v1/households/${HH_ID}/invite`, {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ userId: USER_ID, role: 'member' }),
    })
    expect(res.status).toBe(201)
  })

  it('returns 409 when user is already a member (insert returns empty)', async () => {
    mockSelect.mockReturnValue([makeMember('owner')])
    mockInsert.mockReturnValue([]) // conflict — nothing inserted
    const res = await app.request(`/v1/households/${HH_ID}/invite`, {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ userId: USER_ID, role: 'member' }),
    })
    expect(res.status).toBe(409)
  })

  // Regression tests for the 2026-07-03 audit finding: inviting required
  // knowing another user's raw UUID, which no real person has.
  it('invites by email, resolving it to a userId server-side', async () => {
    mockSelect
      .mockReturnValueOnce([makeMember('owner')]) // membership check
      .mockReturnValueOnce([{ id: USER_ID, email: 'amigo@example.com' }]) // email lookup
    mockInsert.mockReturnValue([
      {
        householdId: HH_ID,
        userId: USER_ID,
        role: 'member',
        invitedAt: new Date(),
        acceptedAt: null,
      },
    ])
    const res = await app.request(`/v1/households/${HH_ID}/invite`, {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ email: 'amigo@example.com', role: 'member' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.userId).toBe(USER_ID)
  })

  it('returns 404 when no user exists with the given email', async () => {
    mockSelect
      .mockReturnValueOnce([makeMember('owner')]) // membership check
      .mockReturnValueOnce([]) // email lookup finds nobody
    const res = await app.request(`/v1/households/${HH_ID}/invite`, {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ email: 'nadie@example.com', role: 'member' }),
    })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('No user found with that email')
  })

  it('returns 400 when neither userId nor email is provided', async () => {
    const res = await app.request(`/v1/households/${HH_ID}/invite`, {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ role: 'member' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('POST /v1/households/:id/accept', () => {
  it('returns 404 when invitation not found', async () => {
    mockUpdate.mockReturnValue([])
    const res = await app.request(`/v1/households/${HH_ID}/accept`, {
      method: 'POST',
      headers: AUTH,
    })
    expect(res.status).toBe(404)
  })

  it('accepts invitation and returns member data', async () => {
    mockUpdate.mockReturnValue([makeMember('member')])
    const res = await app.request(`/v1/households/${HH_ID}/accept`, {
      method: 'POST',
      headers: AUTH,
    })
    expect(res.status).toBe(200)
  })
})

describe('DELETE /v1/households/:id/members/:userId', () => {
  it('returns 404 when requester is not a member', async () => {
    mockSelect.mockReturnValue([])
    const res = await app.request(`/v1/households/${HH_ID}/members/${USER_ID}`, {
      method: 'DELETE',
      headers: AUTH,
    })
    expect(res.status).toBe(404)
  })

  it('returns 403 when requester is a member (not owner/admin)', async () => {
    mockSelect.mockReturnValue([makeMember('member')])
    const res = await app.request(`/v1/households/${HH_ID}/members/${USER_ID}`, {
      method: 'DELETE',
      headers: AUTH,
    })
    expect(res.status).toBe(403)
  })

  it('removes member and returns 204 when requester is owner', async () => {
    mockSelect.mockReturnValue([makeMember('owner')])
    mockDelete.mockReturnValue([makeMember('member')])
    const res = await app.request(`/v1/households/${HH_ID}/members/${USER_ID}`, {
      method: 'DELETE',
      headers: AUTH,
    })
    expect(res.status).toBe(204)
  })

  it('returns 404 when target member not found (delete returns empty)', async () => {
    mockSelect.mockReturnValue([makeMember('owner')])
    mockDelete.mockReturnValue([]) // target user not in household
    const res = await app.request(`/v1/households/${HH_ID}/members/${USER_ID}`, {
      method: 'DELETE',
      headers: AUTH,
    })
    expect(res.status).toBe(404)
  })
})
