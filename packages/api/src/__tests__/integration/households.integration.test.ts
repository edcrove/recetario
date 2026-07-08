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
})
