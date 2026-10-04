import { describe, it, expect } from 'vitest'
import app from '../../index.js'

const skip = process.env['SKIP_INTEGRATION'] === 'true'
const json = { 'Content-Type': 'application/json' }

// Story (Auditar 2026-10-03): a temporary password handed out by the
// reset-password script could never be replaced from the app.
describe.skipIf(skip)('POST /auth/password', () => {
  it('replaces the password, signs out other sessions and keeps this one', async () => {
    const email = `cambio.${Date.now()}@example.com`
    const reg = await app.request('/auth/register', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ email, password: 'temporal123' }),
    })
    const oldToken = (await reg.json()).token as string
    // Revocation compares the token's issue second with the change time, with
    // a 1s grace for clock rounding; let the old token age past it.
    await new Promise((r) => setTimeout(r, 2100))

    const wrong = await app.request('/auth/password', {
      method: 'POST',
      headers: { ...json, Authorization: `Bearer ${oldToken}` },
      body: JSON.stringify({ currentPassword: 'no-es', newPassword: 'mi-clave-nueva' }),
    })
    // 403, not 401: the app signs out on any 401
    expect(wrong.status).toBe(403)

    const res = await app.request('/auth/password', {
      method: 'POST',
      headers: { ...json, Authorization: `Bearer ${oldToken}` },
      body: JSON.stringify({ currentPassword: 'temporal123', newPassword: 'mi-clave-nueva' }),
    })
    expect(res.status).toBe(200)
    const newToken = (await res.json()).token as string

    const meOld = await app.request('/auth/me', {
      headers: { Authorization: `Bearer ${oldToken}` },
    })
    expect(meOld.status).toBe(401)
    const meNew = await app.request('/auth/me', {
      headers: { Authorization: `Bearer ${newToken}` },
    })
    expect(meNew.status).toBe(200)

    const loginOld = await app.request('/auth/login', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ email, password: 'temporal123' }),
    })
    expect(loginOld.status).toBe(401)
    const loginNew = await app.request('/auth/login', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ email, password: 'mi-clave-nueva' }),
    })
    expect(loginNew.status).toBe(200)
  })
})
