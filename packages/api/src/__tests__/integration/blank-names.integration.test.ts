import { describe, it, expect, beforeAll } from 'vitest'

const skip = process.env['SKIP_INTEGRATION'] === 'true'
import app from '../../index.js'
import { TEST_API_KEY, resetTestDb } from './globalSetup.js'

// Bug (2026-10-02 review): required names only checked min(1), so "   " passed
// and the API stored blank recipe titles, ingredients, steps, pantry items and
// household names (an agent could send them; the app trims, the API didn't).

const key = { Authorization: `Bearer ${TEST_API_KEY}`, 'Content-Type': 'application/json' }
let jwt: Record<string, string>

const recipe = (over: object = {}) => ({
  title: 'Sopa',
  servings: 2,
  category: 'Cena',
  ingredients: [{ name: 'agua', quantity: 1, unit: 'l' }],
  steps: [{ text: 'Hervir.' }],
  ...over,
})

async function send(
  method: string,
  path: string,
  body: unknown,
  headers: Record<string, string> = key,
) {
  return app.request(path, { method, headers, body: JSON.stringify(body) })
}

describe.skipIf(skip).sequential('Blank names are rejected and padded ones trimmed', () => {
  beforeAll(async () => {
    await resetTestDb()
    const res = await send(
      'POST',
      '/auth/register',
      { email: `blank-${Date.now()}@example.com`, password: 'password123' },
      { 'Content-Type': 'application/json' },
    )
    jwt = {
      Authorization: `Bearer ${((await res.json()) as { token: string }).token}`,
      'Content-Type': 'application/json',
    }
  })

  const blank = '   '
  const cases: [string, string, string, () => unknown, boolean?][] = [
    ['recipe title', 'POST', '/v1/recipes', () => recipe({ title: blank })],
    [
      'ingredient name',
      'POST',
      '/v1/recipes',
      () => recipe({ ingredients: [{ name: blank, quantity: 1, unit: 'g' }] }),
    ],
    ['step text', 'POST', '/v1/recipes', () => recipe({ steps: [{ text: blank }] })],
    ['pantry item', 'POST', '/v1/pantry', () => ({ name: blank })],
    ['pantry bulk item', 'POST', '/v1/pantry/bulk', () => ({ items: [{ name: blank }] })],
    ['food type', 'POST', '/v1/food-types', () => ({ name: blank })],
    ['collection', 'POST', '/v1/collections', () => ({ name: blank })],
    ['canonical ingredient', 'POST', '/v1/ingredients/canonical', () => ({ name: blank })],
    [
      'suggestion ingredient',
      'POST',
      '/v1/suggestions/from-ingredients',
      () => ({ ingredients: [blank] }),
    ],
    ['household', 'POST', '/v1/households', () => ({ name: blank }), true],
    ['display name', 'PATCH', '/auth/me', () => ({ displayName: blank }), true],
    ['goal', 'PATCH', '/auth/profile', () => ({ goals: [blank] }), true],
  ]

  it.each(cases)('a blank %s is a 400', async (_label, method, path, body, needsUser) => {
    const res = await send(method, path, body(), needsUser ? jwt : key)
    expect(res.status).toBe(400)
  })

  it('a blank display name at sign-up is a 400', async () => {
    const res = await send(
      'POST',
      '/auth/register',
      { email: `b2-${Date.now()}@example.com`, password: 'password123', displayName: blank },
      { 'Content-Type': 'application/json' },
    )
    expect(res.status).toBe(400)
  })

  it('padded names are stored trimmed', async () => {
    const created = await send(
      'POST',
      '/v1/recipes',
      recipe({
        title: '  Sopa de zapallo  ',
        ingredients: [{ name: '  zapallo ', quantity: 1, unit: 'kg' }],
        steps: [{ text: '  Hervir. ' }],
      }),
    )
    expect(created.status).toBe(201)
    const r = (await created.json()) as {
      title: string
      ingredients: { name: string }[]
      steps: { text: string }[]
    }
    expect([r.title, r.ingredients[0]!.name, r.steps[0]!.text]).toEqual([
      'Sopa de zapallo',
      'zapallo',
      'Hervir.',
    ])

    const pantry = await send('POST', '/v1/pantry', { name: ' arroz  ' })
    expect(((await pantry.json()) as { name: string }).name).toBe('arroz')

    const household = await send('POST', '/v1/households', { name: ' Casa ' }, jwt)
    expect(((await household.json()) as { name: string }).name).toBe('Casa')
  })
})
