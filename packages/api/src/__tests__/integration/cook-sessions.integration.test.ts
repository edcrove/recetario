import { describe, it, expect, beforeAll } from 'vitest'

const skip = process.env['SKIP_INTEGRATION'] === 'true'
import app from '../../index.js'
import { resetTestDb } from './globalSetup.js'

async function register(email: string): Promise<{ token: string }> {
  const res = await app.request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123' }),
  })
  return { token: (await res.json()).token as string }
}

const auth = (token: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
})

describe.skipIf(skip).sequential('Cook sessions — cross-tenant title leak (IDOR)', () => {
  let victim: { token: string }
  let attacker: { token: string }
  let privateRecipeId: string
  const SECRET_TITLE = 'Secreto de la abuela'

  beforeAll(async () => {
    await resetTestDb()
    victim = await register(`cook-victima-${Date.now()}@example.com`)
    attacker = await register(`cook-atacante-${Date.now()}@example.com`)

    // Victim owns a PRIVATE recipe; attacker shares no household.
    const rec = await app.request('/v1/recipes', {
      method: 'POST',
      headers: auth(victim.token),
      body: JSON.stringify({
        title: SECRET_TITLE,
        servings: 2,
        category: 'Cena',
        visibility: 'private',
        ingredients: [{ name: 'x', quantity: 1, unit: 'unit' }],
        steps: [{ text: 'Cocinar.' }],
      }),
    })
    privateRecipeId = (await rec.json()).id
  })

  it('POST /v1/cook-sessions does not leak another owner’s private recipe title', async () => {
    const res = await app.request('/v1/cook-sessions', {
      method: 'POST',
      headers: auth(attacker.token),
      body: JSON.stringify({ recipeId: privateRecipeId, rating: 5 }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    // The session is created (history), but with NO leaked title.
    expect(body.recipeTitle).toBeNull()
    expect(JSON.stringify(body)).not.toContain(SECRET_TITLE)
  })

  it('still snapshots the title for the owner’s own recipe', async () => {
    const res = await app.request('/v1/cook-sessions', {
      method: 'POST',
      headers: auth(victim.token),
      body: JSON.stringify({ recipeId: privateRecipeId, rating: 4 }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.recipeTitle).toBe(SECRET_TITLE)
  })
})
