import { describe, it, expect, beforeAll } from 'vitest'

const skip = process.env['SKIP_INTEGRATION'] === 'true'
import app from '../../index.js'
import { resetTestDb } from './globalSetup.js'
import { getDb, schema } from '../../db/index.js'
import { eq } from 'drizzle-orm'

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

// 2026-10-01 audit: context that can't be recovered later is captured at cook time.
describe.skipIf(skip).sequential('Cook sessions — captured context', () => {
  it('stores servings, source and the per-serving nutrition snapshot', async () => {
    const cook = await register(`cook-ctx-${Date.now()}@example.com`)
    const nutrition = { calories: 450, protein_g: 20, carbs_g: 50, fat_g: 15 }
    const rec = await app.request('/v1/recipes', {
      method: 'POST',
      headers: auth(cook.token),
      body: JSON.stringify({
        title: 'Guiso medido',
        servings: 4,
        category: 'Cena',
        nutrition,
        ingredients: [{ name: 'lentejas', quantity: 300, unit: 'g' }],
      }),
    })
    const recipeId = (await rec.json()).id as string

    const res = await app.request('/v1/cook-sessions', {
      method: 'POST',
      headers: auth(cook.token),
      body: JSON.stringify({ recipeId, servings: 3, source: 'app' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toMatchObject({ servings: 3, source: 'app' })

    const [row] = await getDb()
      .select()
      .from(schema.cookSessions)
      .where(eq(schema.cookSessions.id, body.id))
    expect(row?.nutritionSnapshot).toEqual(nutrition)
  })

  it('a password login records lastLoginAt', async () => {
    const email = `login-ctx-${Date.now()}@example.com`
    await register(email)
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' }),
    })
    expect(res.status).toBe(200)
    const [user] = await getDb().select().from(schema.users).where(eq(schema.users.email, email))
    expect(user?.lastLoginAt).toBeInstanceOf(Date)
  })
})

// Mutation testing (2026-10-01): the stats' default 90-day window could be
// changed or dropped without a test failing (every test passed `since`).
describe.skipIf(skip).sequential('Cook stats — default window', () => {
  it('counts the last 90 days when no since is given', async () => {
    const cook = await register(`cook-window-${Date.now()}@example.com`)
    const me = await (await app.request('/auth/me', { headers: auth(cook.token) })).json()
    const rec = await app.request('/v1/recipes', {
      method: 'POST',
      headers: auth(cook.token),
      body: JSON.stringify({
        title: 'Guiso de ventana',
        servings: 2,
        category: 'Cena',
        ingredients: [{ name: 'lentejas', quantity: 200, unit: 'g' }],
      }),
    })
    const recipeId = (await rec.json()).id as string
    const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000)
    await getDb()
      .insert(schema.cookSessions)
      .values([
        { recipeId, recipeTitle: 'Guiso de ventana', ownerId: me.id, cookedAt: daysAgo(10) },
        { recipeId, recipeTitle: 'Guiso de ventana', ownerId: me.id, cookedAt: daysAgo(80) },
        { recipeId, recipeTitle: 'Guiso de ventana', ownerId: me.id, cookedAt: daysAgo(100) },
      ])

    const stats = await (
      await app.request('/v1/cook-sessions/stats', { headers: auth(cook.token) })
    ).json()
    expect(stats.totalSessions).toBe(2)
    // `since` is the window start truncated to its UTC date, so it lies 90 to
    // <91 days back depending on the time of day (Math.round flaked after noon)
    const sinceDays = (Date.now() - new Date(stats.since).getTime()) / (24 * 60 * 60 * 1000)
    expect(Math.floor(sinceDays)).toBe(90)
  })
})
