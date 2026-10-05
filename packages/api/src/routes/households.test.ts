import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockInsert, mockSelect, mockUpdate, mockDelete, withTransaction } = vi.hoisted(() => ({
  // db.transaction(fn) runs fn against the same mocked handle
  withTransaction: <T extends object>(db: T) =>
    Object.assign(db, { transaction: (fn: (tx: T) => unknown) => fn(db) }),
  mockInsert: vi.fn(),
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}))

vi.mock('../db/index.js', () => ({
  getDb: vi.fn(() =>
    withTransaction({
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
    }),
  ),
  schema: {
    households: {},
    householdMembers: { householdId: 'hh', userId: 'uid', role: 'role', acceptedAt: 'acc' },
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
import { householdRepository } from '../db/household-repository.js'
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
  it("returns the repository's households for the caller", async () => {
    const households = [
      {
        id: HH_ID,
        name: 'Casa',
        ownerId: 'dev',
        createdAt: '2026-07-01T00:00:00.000Z',
        members: [
          {
            userId: 'dev',
            role: 'owner' as const,
            invitedAt: '2026-07-01T00:00:00.000Z',
            acceptedAt: '2026-07-01T00:00:00.000Z',
            displayName: 'Ana',
            email: 'ana@x.com',
          },
        ],
        diners: [
          {
            id: '00000000-0000-4000-8000-0000000000d1',
            householdId: '00000000-0000-4000-8000-000000000001',
            name: 'Sofi',
            allergens: ['mani'],
            dietaryRestrictions: [],
          },
        ],
      },
    ]
    const spy = vi.spyOn(householdRepository, 'listForUser').mockResolvedValueOnce(households)
    const res = await app.request('/v1/households/mine', {
      headers: { Authorization: 'Bearer test-key' },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(households)
    expect(spy).toHaveBeenCalledWith('dev')
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

describe('pending invitations grant no management rights', () => {
  const pending = (role: string) => ({ ...makeMember(role), acceptedAt: null })

  it('a pending admin cannot invite (403)', async () => {
    mockSelect.mockReturnValue([pending('admin')])
    const res = await app.request(`/v1/households/${HH_ID}/invite`, {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ userId: USER_ID, role: 'member' }),
    })
    expect(res.status).toBe(403)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('a pending admin cannot remove members (403)', async () => {
    mockSelect.mockReturnValue([pending('admin')])
    const res = await app.request(`/v1/households/${HH_ID}/members/${USER_ID}`, {
      method: 'DELETE',
      headers: AUTH,
    })
    expect(res.status).toBe(403)
    expect(mockDelete).not.toHaveBeenCalled()
  })
})

describe('POST /v1/households/:id/decline', () => {
  it('removes my pending invitation and returns 204', async () => {
    mockDelete.mockReturnValue([{ ...makeMember('member'), acceptedAt: null }])
    const res = await app.request(`/v1/households/${HH_ID}/decline`, {
      method: 'POST',
      headers: AUTH,
    })
    expect(res.status).toBe(204)
  })

  it('returns 404 when there is no pending invitation (already accepted or none)', async () => {
    mockDelete.mockReturnValue([])
    const res = await app.request(`/v1/households/${HH_ID}/decline`, {
      method: 'POST',
      headers: AUTH,
    })
    expect(res.status).toBe(404)
  })
})

// Story "App: gestión de household (invitar, roles)": "Owner puede cambiar rol
// o remover miembro. Miembro puede ver y abandonar el hogar."
describe('PATCH /v1/households/:id/members/:userId (change role)', () => {
  afterEach(() => vi.restoreAllMocks())
  const patch = (body: unknown) =>
    app.request(`/v1/households/${HH_ID}/members/${USER_ID}`, {
      method: 'PATCH',
      headers: AUTH,
      body: JSON.stringify(body),
    })

  it('the owner changes a member to viewer and gets the updated member (200)', async () => {
    mockSelect.mockReturnValue([makeMember('owner')])
    mockUpdate.mockReturnValue([{ ...makeMember('viewer'), userId: USER_ID }])
    const canManage = vi.spyOn(householdRepository, 'canManage')
    const changeRole = vi.spyOn(householdRepository, 'changeRole')
    const res = await patch({ role: 'viewer' })
    expect(res.status).toBe(200)
    // Rights are checked for the caller ('dev' under DEV_API_KEY), not the target
    expect(canManage).toHaveBeenCalledWith(HH_ID, 'dev')
    expect(changeRole).toHaveBeenCalledWith(HH_ID, USER_ID, 'viewer')
    const body = (await res.json()) as { userId: string; role: string }
    expect(body).toMatchObject({ userId: USER_ID, role: 'viewer' })
  })

  it('an admin can change roles too (same rights as invite/remove)', async () => {
    mockSelect.mockReturnValue([makeMember('admin')])
    mockUpdate.mockReturnValue([makeMember('member')])
    expect((await patch({ role: 'member' })).status).toBe(200)
  })

  it('a plain member cannot change roles (403) and nothing is written', async () => {
    mockSelect.mockReturnValue([makeMember('member')])
    const res = await patch({ role: 'admin' })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Forbidden' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('a pending admin cannot change roles (403)', async () => {
    mockSelect.mockReturnValue([{ ...makeMember('admin'), acceptedAt: null }])
    expect((await patch({ role: 'viewer' })).status).toBe(403)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 404 when the requester is not in the household', async () => {
    mockSelect.mockReturnValue([])
    const res = await patch({ role: 'viewer' })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Household not found' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 404 when the target is not a (non-owner) member', async () => {
    mockSelect.mockReturnValue([makeMember('owner')])
    mockUpdate.mockReturnValue([])
    const res = await patch({ role: 'admin' })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Member not found' })
  })

  it('rejects promoting anyone to owner (400)', async () => {
    mockSelect.mockReturnValue([makeMember('owner')])
    expect((await patch({ role: 'owner' })).status).toBe(400)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('rejects a missing role (400)', async () => {
    expect((await patch({})).status).toBe(400)
  })

  it('requires auth (401)', async () => {
    const res = await app.request(`/v1/households/${HH_ID}/members/${USER_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'viewer' }),
    })
    expect(res.status).toBe(401)
  })
})

describe('POST /v1/households/:id/leave', () => {
  afterEach(() => vi.restoreAllMocks())
  const leave = () =>
    app.request(`/v1/households/${HH_ID}/leave`, { method: 'POST', headers: AUTH })

  it('an accepted member leaves (204) and their membership is deleted', async () => {
    mockSelect.mockReturnValue([makeMember('member')])
    mockDelete.mockReturnValue([makeMember('member')])
    const leaveSpy = vi.spyOn(householdRepository, 'leave')
    expect((await leave()).status).toBe(204)
    // It is the caller who leaves, never someone else
    expect(leaveSpy).toHaveBeenCalledWith(HH_ID, 'dev')
    expect(mockDelete).toHaveBeenCalledTimes(1)
  })

  it('a viewer can leave too', async () => {
    mockSelect.mockReturnValue([makeMember('viewer')])
    mockDelete.mockReturnValue([makeMember('viewer')])
    expect((await leave()).status).toBe(204)
  })

  it('the owner cannot leave (409) and nothing is deleted', async () => {
    mockSelect.mockReturnValue([makeMember('owner')])
    const res = await leave()
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'The owner cannot leave the household' })
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('a pending invitee is told to decline instead (404)', async () => {
    mockSelect.mockReturnValue([{ ...makeMember('member'), acceptedAt: null }])
    expect((await leave()).status).toBe(404)
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('returns 404 when not a member at all', async () => {
    mockSelect.mockReturnValue([])
    const res = await leave()
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Household not found' })
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('requires auth (401)', async () => {
    const res = await app.request(`/v1/households/${HH_ID}/leave`, { method: 'POST' })
    expect(res.status).toBe(401)
  })
})

// Story (Auditar 2026-10-03): a kid's allergies, set once for the household,
// warn every member.
describe('household diners', () => {
  const HH = '00000000-0000-4000-8000-0000000000a1'
  const DINER = '00000000-0000-4000-8000-0000000000d1'
  const auth = { Authorization: 'Bearer test-key', 'Content-Type': 'application/json' }
  const sofi = { name: 'Sofi', allergens: ['maní'], dietaryRestrictions: ['sin-gluten'] }
  const saved = { id: DINER, householdId: HH, ...sofi, allergens: ['mani'] }
  const send = (method: string, path: string, body?: unknown) =>
    app.request(`/v1/households/${HH}${path}`, {
      method,
      headers: auth,
      body: body === undefined ? undefined : JSON.stringify(body),
    })

  afterEach(() => vi.restoreAllMocks())

  it('a member adds one (201)', async () => {
    vi.spyOn(householdRepository, 'canEditDiners').mockResolvedValueOnce('yes')
    const add = vi.spyOn(householdRepository, 'addDiner').mockResolvedValueOnce(saved)
    const res = await send('POST', '/diners', sofi)
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual(saved)
    expect(add).toHaveBeenCalledWith(HH, sofi)
  })

  it('needs a name and known diets (400)', async () => {
    expect((await send('POST', '/diners', { ...sofi, name: '  ' })).status).toBe(400)
    expect((await send('POST', '/diners', { ...sofi, dietaryRestrictions: ['x'] })).status).toBe(
      400,
    )
  })

  it('a viewer cannot change them (403); an outsider sees no household (404)', async () => {
    const access = vi.spyOn(householdRepository, 'canEditDiners')
    access.mockResolvedValue('no')
    expect((await send('POST', '/diners', sofi)).status).toBe(403)
    expect((await send('PUT', `/diners/${DINER}`, sofi)).status).toBe(403)
    expect((await send('DELETE', `/diners/${DINER}`)).status).toBe(403)
    access.mockResolvedValue('not_member')
    expect((await send('POST', '/diners', sofi)).status).toBe(404)
    expect((await send('PUT', `/diners/${DINER}`, sofi)).status).toBe(404)
    expect((await send('DELETE', `/diners/${DINER}`)).status).toBe(404)
  })

  it('updates one (200) or says it is gone (404)', async () => {
    vi.spyOn(householdRepository, 'canEditDiners').mockResolvedValue('yes')
    const update = vi.spyOn(householdRepository, 'updateDiner')
    update.mockResolvedValueOnce(saved)
    const ok = await send('PUT', `/diners/${DINER}`, sofi)
    expect(ok.status).toBe(200)
    expect(update).toHaveBeenCalledWith(HH, DINER, sofi)
    update.mockResolvedValueOnce(null)
    expect((await send('PUT', `/diners/${DINER}`, sofi)).status).toBe(404)
  })

  it('removes one (204) or says it is gone (404)', async () => {
    vi.spyOn(householdRepository, 'canEditDiners').mockResolvedValue('yes')
    const remove = vi.spyOn(householdRepository, 'removeDiner')
    remove.mockResolvedValueOnce(true)
    expect((await send('DELETE', `/diners/${DINER}`)).status).toBe(204)
    remove.mockResolvedValueOnce(false)
    expect((await send('DELETE', `/diners/${DINER}`)).status).toBe(404)
  })
})
