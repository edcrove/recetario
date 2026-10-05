import { describe, it, expect, beforeAll } from 'vitest'
import app from '../../index.js'
import { resetTestDb } from './globalSetup.js'

const skip = process.env['SKIP_INTEGRATION'] === 'true'

async function register(email: string): Promise<string> {
  const res = await app.request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123' }),
  })
  return (await res.json()).token as string
}

const auth = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
})

const mine = async (token: string) =>
  (await (await app.request('/v1/households/mine', { headers: auth(token) })).json()) as Array<{
    id: string
    diners: Array<{ id: string; name: string; allergens: string[]; dietaryRestrictions: string[] }>
  }>

// Story (Auditar 2026-10-03): a kid's allergies, recorded once for the
// household, reach the other parent; a viewer can read but not change them.
describe.skipIf(skip).sequential('Household diners', () => {
  let parent: string
  let partner: string
  let viewer: string
  let outsider: string
  let householdId: string

  beforeAll(async () => {
    await resetTestDb()
    const stamp = Date.now()
    parent = await register(`padre-${stamp}@example.com`)
    partner = await register(`madre-${stamp}@example.com`)
    viewer = await register(`abuela-${stamp}@example.com`)
    outsider = await register(`vecino-${stamp}@example.com`)
    const hh = await app.request('/v1/households', {
      method: 'POST',
      headers: auth(parent),
      body: JSON.stringify({ name: 'Casa' }),
    })
    householdId = (await hh.json()).id
    for (const [token, email, role] of [
      [partner, `madre-${stamp}@example.com`, 'member'],
      [viewer, `abuela-${stamp}@example.com`, 'viewer'],
    ] as const) {
      await app.request(`/v1/households/${householdId}/invite`, {
        method: 'POST',
        headers: auth(parent),
        body: JSON.stringify({ email, role }),
      })
      await app.request(`/v1/households/${householdId}/accept`, {
        method: 'POST',
        headers: auth(token),
      })
    }
  })

  it('one parent adds the kid; the other sees the allergies, normalized', async () => {
    const res = await app.request(`/v1/households/${householdId}/diners`, {
      method: 'POST',
      headers: auth(parent),
      body: JSON.stringify({ name: 'Sofi', allergens: ['Maní', 'TACC'] }),
    })
    expect(res.status).toBe(201)
    const [hh] = await mine(partner)
    expect(hh!.diners).toEqual([
      expect.objectContaining({
        name: 'Sofi',
        allergens: ['mani', 'gluten'],
        dietaryRestrictions: [],
      }),
    ])
  })

  it('the partner edits it; a viewer and an outsider cannot', async () => {
    const [hh] = await mine(partner)
    const id = hh!.diners[0]!.id
    const body = JSON.stringify({
      name: 'Sofi',
      allergens: ['mani'],
      dietaryRestrictions: ['vegetariano'],
    })
    const put = (token: string) =>
      app.request(`/v1/households/${householdId}/diners/${id}`, {
        method: 'PUT',
        headers: auth(token),
        body,
      })
    expect((await put(partner)).status).toBe(200)
    expect((await put(viewer)).status).toBe(403)
    expect((await put(outsider)).status).toBe(404)
    const [seenByViewer] = await mine(viewer)
    expect(seenByViewer!.diners[0]).toMatchObject({ dietaryRestrictions: ['vegetariano'] })
    expect(await mine(outsider)).toEqual([])
  })

  it('a diner from another household cannot be touched through this one', async () => {
    const other = await app.request('/v1/households', {
      method: 'POST',
      headers: auth(outsider),
      body: JSON.stringify({ name: 'Otra casa' }),
    })
    const otherId = (await other.json()).id as string
    const added = await app.request(`/v1/households/${otherId}/diners`, {
      method: 'POST',
      headers: auth(outsider),
      body: JSON.stringify({ name: 'Juan' }),
    })
    const juan = (await added.json()).id as string
    const del = await app.request(`/v1/households/${householdId}/diners/${juan}`, {
      method: 'DELETE',
      headers: auth(parent),
    })
    expect(del.status).toBe(404)
  })

  it('removing the kid takes the warnings away for everyone', async () => {
    const [hh] = await mine(parent)
    const del = await app.request(`/v1/households/${householdId}/diners/${hh!.diners[0]!.id}`, {
      method: 'DELETE',
      headers: auth(parent),
    })
    expect(del.status).toBe(204)
    expect((await mine(partner))[0]!.diners).toEqual([])
  })
})
