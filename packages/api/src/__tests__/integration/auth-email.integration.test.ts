import { describe, it, expect } from 'vitest'
import app from '../../index.js'

const skip = process.env['SKIP_INTEGRATION'] === 'true'
const json = { 'Content-Type': 'application/json' }

describe.skipIf(skip)('emails are case-insensitive', () => {
  const stamp = Date.now()
  const mixed = `Ana.${stamp}@Example.COM`
  const lower = mixed.toLowerCase()

  it('stores the email lowercased, rejects a case-variant duplicate, logs in any case', async () => {
    const reg = await app.request('/auth/register', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ email: mixed, password: 'secreto123' }),
    })
    expect(reg.status).toBe(201)
    expect((await reg.json()).user.email).toBe(lower)

    const dup = await app.request('/auth/register', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ email: lower.toUpperCase(), password: 'secreto123' }),
    })
    expect(dup.status).toBe(409)

    const login = await app.request('/auth/login', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ email: ` ${lower.toUpperCase()} `.trim(), password: 'secreto123' }),
    })
    expect(login.status).toBe(200)
  })

  it('finds an invitee by email regardless of case', async () => {
    const owner = await app.request('/auth/register', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ email: `owner.${stamp}@example.com`, password: 'secreto123' }),
    })
    const { token } = (await owner.json()) as { token: string }
    const auth = { ...json, Authorization: `Bearer ${token}` }
    const hh = await app.request('/v1/households', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ name: 'Casa' }),
    })
    const { id } = (await hh.json()) as { id: string }
    const invite = await app.request(`/v1/households/${id}/invite`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ email: mixed.toUpperCase(), role: 'member' }),
    })
    expect(invite.status).toBe(201)
  })
})
