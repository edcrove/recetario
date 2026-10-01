import { describe, it, expect, beforeAll } from 'vitest'

const skip = process.env['SKIP_INTEGRATION'] === 'true'
import app from '../../index.js'
import { resetTestDb } from './globalSetup.js'

// Regression suite for the 2026-07-03 audit finding: inviting a household
// member required pasting their raw UUID — verified live against the API
// that inviting by email was rejected outright. Now email is a first-class
// way to invite, resolved to a userId server-side.
describe.skipIf(skip).sequential('Household invite by email', () => {
  let ownerToken: string
  let inviteeEmail: string
  let inviteeUserId: string
  let householdId: string

  beforeAll(async () => {
    await resetTestDb()

    const ownerEmail = `owner-${Date.now()}@example.com`
    const ownerRes = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerEmail, password: 'password123' }),
    })
    ownerToken = (await ownerRes.json()).token

    inviteeEmail = `amigo-${Date.now()}@example.com`
    const inviteeRes = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteeEmail, password: 'password123' }),
    })
    inviteeUserId = (await inviteeRes.json()).user.id

    const householdRes = await app.request('/v1/households', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Familia E2E' }),
    })
    householdId = (await householdRes.json()).id
  })

  it('invites a real user by email and resolves the correct userId', async () => {
    const res = await app.request(`/v1/households/${householdId}/invite`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteeEmail, role: 'member' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.userId).toBe(inviteeUserId)
  })

  it('returns 404 when inviting an email with no matching user', async () => {
    const res = await app.request(`/v1/households/${householdId}/invite`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nadie-existe@example.com', role: 'member' }),
    })
    expect(res.status).toBe(404)
  })

  it('still accepts a raw userId for backward compatibility (e.g. MCP agents)', async () => {
    const thirdEmail = `tercero-${Date.now()}@example.com`
    const thirdRes = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: thirdEmail, password: 'password123' }),
    })
    const thirdUserId = (await thirdRes.json()).user.id

    const res = await app.request(`/v1/households/${householdId}/invite`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: thirdUserId, role: 'viewer' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.userId).toBe(thirdUserId)
  })

  it('lists the pending invitee with no acceptedAt, the owner as accepted', async () => {
    const res = await app.request('/v1/households/mine', {
      headers: { Authorization: `Bearer ${ownerToken}` },
    })
    const [household] = (await res.json()) as {
      members: { userId: string; role: string; acceptedAt: string | null }[]
    }[]
    const invitee = household!.members.find((m) => m.userId === inviteeUserId)
    expect(invitee?.acceptedAt).toBeNull()
    expect(household!.members.find((m) => m.role === 'owner')?.acceptedAt).not.toBeNull()
  })
})

// Story "App: gestión de household (invitar, roles)": the owner changes a
// member's role; a member leaves; the owner can't. Checked against Postgres so
// the owner-exclusion and the sharing consequences are real.
describe.skipIf(skip).sequential('Household roles and leaving', () => {
  const json = (token: string) => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  })
  async function register(prefix: string) {
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `${prefix}-${Date.now()}@example.com`,
        password: 'password123',
      }),
    })
    const body = (await res.json()) as { token: string; user: { id: string } }
    return { token: body.token, id: body.user.id }
  }
  const mine = async (token: string) =>
    (await (await app.request('/v1/households/mine', { headers: json(token) })).json()) as {
      id: string
      members: { userId: string; role: string }[]
    }[]

  let owner: { token: string; id: string }
  let member: { token: string; id: string }
  let householdId: string
  let sharedRecipeId: string

  beforeAll(async () => {
    await resetTestDb()
    owner = await register('roles-owner')
    member = await register('roles-member')
    householdId = (
      (await (
        await app.request('/v1/households', {
          method: 'POST',
          headers: json(owner.token),
          body: JSON.stringify({ name: 'Casa roles' }),
        })
      ).json()) as { id: string }
    ).id
    await app.request(`/v1/households/${householdId}/invite`, {
      method: 'POST',
      headers: json(owner.token),
      body: JSON.stringify({ userId: member.id, role: 'member' }),
    })
    await app.request(`/v1/households/${householdId}/accept`, {
      method: 'POST',
      headers: json(member.token),
    })
    sharedRecipeId = (
      (await (
        await app.request('/v1/recipes', {
          method: 'POST',
          headers: json(owner.token),
          body: JSON.stringify({
            title: 'Receta compartida roles',
            servings: 2,
            category: 'Cena',
            ingredients: [{ name: 'Arroz', quantity: 1, unit: 'cup' }],
            steps: [{ text: 'Cocinar.' }],
          }),
        })
      ).json()) as { id: string }
    ).id
  })

  it('as a member they can plan the shared menu (baseline for the role change)', async () => {
    const res = await app.request('/v1/menu', {
      method: 'POST',
      headers: json(member.token),
      body: JSON.stringify({ date: '2027-03-01', slot: 'Cena', recipeId: sharedRecipeId }),
    })
    expect(res.ok).toBe(true)
  })

  it('the owner changes the member to viewer, and the change is what /mine shows', async () => {
    const res = await app.request(`/v1/households/${householdId}/members/${member.id}`, {
      method: 'PATCH',
      headers: json(owner.token),
      body: JSON.stringify({ role: 'viewer' }),
    })
    expect(res.status).toBe(200)
    expect(((await res.json()) as { role: string }).role).toBe('viewer')
    const [hh] = await mine(member.token)
    expect(hh!.members.find((m) => m.userId === member.id)?.role).toBe('viewer')
  })

  it('the new viewer role takes effect: the viewer can no longer plan the shared menu', async () => {
    const res = await app.request('/v1/menu', {
      method: 'POST',
      headers: json(member.token),
      body: JSON.stringify({ date: '2027-03-01', slot: 'Cena', recipeId: sharedRecipeId }),
    })
    expect(res.status).toBe(403)
  })

  it("the owner's own role cannot be changed (404, owner row untouched)", async () => {
    const res = await app.request(`/v1/households/${householdId}/members/${owner.id}`, {
      method: 'PATCH',
      headers: json(owner.token),
      body: JSON.stringify({ role: 'member' }),
    })
    expect(res.status).toBe(404)
    const [hh] = await mine(owner.token)
    expect(hh!.members.find((m) => m.userId === owner.id)?.role).toBe('owner')
  })

  it('a viewer cannot change anyone (403)', async () => {
    const res = await app.request(`/v1/households/${householdId}/members/${member.id}`, {
      method: 'PATCH',
      headers: json(member.token),
      body: JSON.stringify({ role: 'admin' }),
    })
    expect(res.status).toBe(403)
  })

  it('the owner cannot leave (409) and stays the owner', async () => {
    const res = await app.request(`/v1/households/${householdId}/leave`, {
      method: 'POST',
      headers: json(owner.token),
    })
    expect(res.status).toBe(409)
    expect((await mine(owner.token)).map((h) => h.id)).toContain(householdId)
  })

  it('the member sees the shared recipe before leaving', async () => {
    const res = await app.request(`/v1/recipes/${sharedRecipeId}`, { headers: json(member.token) })
    expect(res.status).toBe(200)
  })

  it('the member leaves (204): the household is gone from their list and the owner sees them gone', async () => {
    const res = await app.request(`/v1/households/${householdId}/leave`, {
      method: 'POST',
      headers: json(member.token),
    })
    expect(res.status).toBe(204)
    expect(await mine(member.token)).toEqual([])
    const [hh] = await mine(owner.token)
    expect(hh!.members.map((m) => m.userId)).toEqual([owner.id])
  })

  it('after leaving, the shared recipe is no longer visible to them', async () => {
    const res = await app.request(`/v1/recipes/${sharedRecipeId}`, { headers: json(member.token) })
    expect(res.status).toBe(404)
  })

  it('the repository reports each leave outcome explicitly', async () => {
    const { householdRepository } = await import('../../db/household-repository.js')
    const third = await register('roles-third')
    await app.request(`/v1/households/${householdId}/invite`, {
      method: 'POST',
      headers: json(owner.token),
      body: JSON.stringify({ userId: third.id, role: 'admin' }),
    })
    // Pending: not joined yet, so nothing to leave
    expect(await householdRepository.leave(householdId, third.id)).toBe('not_member')
    await app.request(`/v1/households/${householdId}/accept`, {
      method: 'POST',
      headers: json(third.token),
    })
    expect(await householdRepository.leave(householdId, owner.id)).toBe('owner')
    expect(await householdRepository.leave(householdId, third.id)).toBe('left')
  })

  it('leaving twice is a 404', async () => {
    const res = await app.request(`/v1/households/${householdId}/leave`, {
      method: 'POST',
      headers: json(member.token),
    })
    expect(res.status).toBe(404)
  })
})
