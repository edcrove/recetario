import { describe, it, expect, beforeAll, vi } from 'vitest'

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

  // Auditar 2026-10-03: the session used to be created (201, null title),
  // polluting the recipe's ratings and telling apart private from missing ids.
  it('POST /v1/cook-sessions refuses another owner’s private recipe like a missing one', async () => {
    for (const recipeId of [privateRecipeId, '00000000-0000-4000-8000-000000000000']) {
      const res = await app.request('/v1/cook-sessions', {
        method: 'POST',
        headers: auth(attacker.token),
        body: JSON.stringify({ recipeId, rating: 1 }),
      })
      expect(res.status).toBe(404)
      expect(JSON.stringify(await res.json())).not.toContain(SECRET_TITLE)
    }
    const mine = await (
      await app.request('/v1/cook-sessions', { headers: auth(attacker.token) })
    ).json()
    expect(mine).toEqual([])
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

// Story "App: pantalla de stats y tendencias": "streak de días consecutivos
// cocinando". Days are counted in the person's time zone, against Postgres.
describe.skipIf(skip).sequential('Cook stats — streak', () => {
  const DAY = 24 * 60 * 60 * 1000
  async function cookAt(token: string, ownerId: string, when: Date) {
    const rec = await app.request('/v1/recipes', {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({
        title: 'Racha',
        servings: 1,
        category: 'Cena',
        ingredients: [{ name: 'arroz', quantity: 1, unit: 'cup' }],
      }),
    })
    const recipeId = (await rec.json()).id as string
    await getDb()
      .insert(schema.cookSessions)
      .values({ recipeId, recipeTitle: 'Racha', ownerId, cookedAt: when })
  }
  async function me(token: string) {
    return (await (await app.request('/auth/me', { headers: auth(token) })).json()) as {
      id: string
    }
  }
  async function streak(token: string) {
    const res = await app.request('/v1/cook-sessions/stats', { headers: auth(token) })
    return ((await res.json()) as { streak: { current: number; longest: number } }).streak
  }

  it('today, yesterday and the day before (two cooks one day) make a streak of 3', async () => {
    const cook = await register(`racha-${Date.now()}@example.com`)
    const { id } = await me(cook.token)
    // Anchored at today's UTC noon so the days never straddle midnight
    const noon = new Date(new Date().toISOString().slice(0, 10) + 'T12:00:00Z').getTime()
    await cookAt(cook.token, id, new Date(noon))
    await cookAt(cook.token, id, new Date(noon - DAY))
    await cookAt(cook.token, id, new Date(noon - DAY - 60 * 60 * 1000)) // same day, twice
    await cookAt(cook.token, id, new Date(noon - 2 * DAY))
    // An older run of 4, separated by a gap: the longest
    for (const d of [20, 21, 22, 23]) await cookAt(cook.token, id, new Date(noon - d * DAY))
    expect(await streak(cook.token)).toEqual({ current: 3, longest: 4 })
  })

  it('counts days in the profile time zone: a late dinner is that local day', async () => {
    const cook = await register(`racha-tz-${Date.now()}@example.com`)
    const { id } = await me(cook.token)
    await app.request('/auth/profile', {
      method: 'PATCH',
      headers: auth(cook.token),
      body: JSON.stringify({ timezone: 'America/Montevideo' }),
    })
    const { cookSessionsRepository } = await import('../../db/cook-sessions-repository.js')
    // 01:30 UTC on the 30th is 22:30 on the 29th in Montevideo (UTC-3)
    await cookAt(cook.token, id, new Date('2026-09-30T01:30:00Z'))
    await cookAt(cook.token, id, new Date('2026-09-30T14:00:00Z'))
    const { days, today } = await cookSessionsRepository.cookDays(id)
    expect(days.sort()).toEqual(['2026-09-29', '2026-09-30'])
    const montevideoToday = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Montevideo',
    }).format(new Date())
    expect(today).toBe(montevideoToday)
  })

  it("another person's cooking never counts toward my streak", async () => {
    const a = await register(`racha-a-${Date.now()}@example.com`)
    const b = await register(`racha-b-${Date.now()}@example.com`)
    const { id: aId } = await me(a.token)
    await cookAt(a.token, aId, new Date())
    expect(await streak(b.token)).toEqual({ current: 0, longest: 0 })
    expect((await streak(a.token)).current).toBe(1)
  })

  it('an API-key owner without a profile uses UTC days', async () => {
    const { cookSessionsRepository } = await import('../../db/cook-sessions-repository.js')
    const { days, today } = await cookSessionsRepository.cookDays('dev')
    expect(days).toEqual([])
    expect(today).toBe(new Date().toISOString().slice(0, 10))
  })

  it("'today' is the profile zone's date, not the server's", async () => {
    const cook = await register(`racha-kiri-${Date.now()}@example.com`)
    const { id } = await me(cook.token)
    await app.request('/auth/profile', {
      method: 'PATCH',
      headers: auth(cook.token),
      body: JSON.stringify({ timezone: 'Pacific/Kiritimati' }), // UTC+14
    })
    const { cookSessionsRepository } = await import('../../db/cook-sessions-repository.js')
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-09-30T23:00:00Z') })
    try {
      // 23:00 UTC on the 30th is already the 1st in Kiritimati
      expect((await cookSessionsRepository.cookDays(id)).today).toBe('2026-10-01')
    } finally {
      vi.useRealTimers()
    }
  })

  it('a user id without a profile row falls back to UTC instead of failing', async () => {
    const { cookSessionsRepository } = await import('../../db/cook-sessions-repository.js')
    const { days, today } = await cookSessionsRepository.cookDays(
      '00000000-0000-4000-8000-000000000001',
    )
    expect(days).toEqual([])
    expect(today).toBe(new Date().toISOString().slice(0, 10))
  })
})
