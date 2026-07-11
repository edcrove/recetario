import { describe, it, expect, beforeAll } from 'vitest'

const skip = process.env['SKIP_INTEGRATION'] === 'true'
import app from '../../index.js'
import { resetTestDb } from './globalSetup.js'

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}
async function register(email: string): Promise<{ token: string; userId: string }> {
  const res = await app.request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123' }),
  })
  const body = await res.json()
  return { token: body.token, userId: body.user.id }
}

type PantryItem = { id: string; name: string; inStock: boolean }

describe.skipIf(skip).sequential('Pantry integration', () => {
  let owner: { token: string; userId: string }
  let member: { token: string; userId: string }
  let outsider: { token: string; userId: string }
  let itemId: string

  beforeAll(async () => {
    await resetTestDb()
    owner = await register(`p-owner-${Date.now()}@example.com`)
    member = await register(`p-member-${Date.now()}@example.com`)
    outsider = await register(`p-outsider-${Date.now()}@example.com`)

    const hh = await app.request('/v1/households', {
      method: 'POST',
      headers: auth(owner.token),
      body: JSON.stringify({ name: 'Casa' }),
    })
    const householdId = (await hh.json()).id
    await app.request(`/v1/households/${householdId}/invite`, {
      method: 'POST',
      headers: auth(owner.token),
      body: JSON.stringify({ userId: member.userId, role: 'member' }),
    })
  })

  it('creates a pantry item (201) and lists it', async () => {
    const res = await app.request('/v1/pantry', {
      method: 'POST',
      headers: auth(owner.token),
      body: JSON.stringify({ name: 'Harina', quantity: '1', unit: 'kg', expiryDate: '2027-01-01' }),
    })
    expect(res.status).toBe(201)
    itemId = (await res.json()).id

    const list = (await (
      await app.request('/v1/pantry', { headers: auth(owner.token) })
    ).json()) as PantryItem[]
    expect(list.some((i) => i.id === itemId)).toBe(true)
  })

  it("a household member sees and can edit the owner's pantry", async () => {
    const list = (await (
      await app.request('/v1/pantry', { headers: auth(member.token) })
    ).json()) as PantryItem[]
    expect(list.some((i) => i.id === itemId)).toBe(true)

    const patch = await app.request(`/v1/pantry/${itemId}`, {
      method: 'PATCH',
      headers: auth(member.token),
      body: JSON.stringify({ inStock: false }),
    })
    expect(patch.status).toBe(200)
    expect((await patch.json()).inStock).toBe(false)
  })

  it('updates name, quantity, unit and expiry in one PATCH', async () => {
    const created = (await (
      await app.request('/v1/pantry', {
        method: 'POST',
        headers: auth(owner.token),
        body: JSON.stringify({ name: 'Fideo' }),
      })
    ).json()) as PantryItem
    const patch = await app.request(`/v1/pantry/${created.id}`, {
      method: 'PATCH',
      headers: auth(owner.token),
      body: JSON.stringify({
        name: 'Fideos secos',
        quantity: '500',
        unit: 'g',
        expiryDate: '2027-06-01',
      }),
    })
    expect(patch.status).toBe(200)
    const body = (await patch.json()) as {
      name: string
      quantity: string
      unit: string
      expiryDate: string
    }
    expect(body).toMatchObject({
      name: 'Fideos secos',
      quantity: '500',
      unit: 'g',
      expiryDate: '2027-06-01',
    })
    await app.request(`/v1/pantry/${created.id}`, { method: 'DELETE', headers: auth(owner.token) })
  })

  it("an outsider cannot see, edit or delete the household's pantry", async () => {
    const list = (await (
      await app.request('/v1/pantry', { headers: auth(outsider.token) })
    ).json()) as PantryItem[]
    expect(list.some((i) => i.id === itemId)).toBe(false)

    const patch = await app.request(`/v1/pantry/${itemId}`, {
      method: 'PATCH',
      headers: auth(outsider.token),
      body: JSON.stringify({ inStock: true }),
    })
    expect(patch.status).toBe(404)

    const del = await app.request(`/v1/pantry/${itemId}`, {
      method: 'DELETE',
      headers: auth(outsider.token),
    })
    expect(del.status).toBe(404)
  })

  it('the owner deletes the item (204) and it is gone', async () => {
    const del = await app.request(`/v1/pantry/${itemId}`, {
      method: 'DELETE',
      headers: auth(owner.token),
    })
    expect(del.status).toBe(204)
    const list = (await (
      await app.request('/v1/pantry', { headers: auth(owner.token) })
    ).json()) as PantryItem[]
    expect(list.some((i) => i.id === itemId)).toBe(false)
  })

  it('listInStockNames returns only in-stock names for the household', async () => {
    const { pantryRepository } = await import('../../db/pantry-repository.js')
    await app.request('/v1/pantry', {
      method: 'POST',
      headers: auth(owner.token),
      body: JSON.stringify({ name: 'Arroz', inStock: true }),
    })
    await app.request('/v1/pantry', {
      method: 'POST',
      headers: auth(owner.token),
      body: JSON.stringify({ name: 'Lentejas', inStock: false }),
    })
    const names = await pantryRepository.listInStockNames(member.userId)
    expect(names).toContain('Arroz')
    expect(names).not.toContain('Lentejas')
  })
})
