import { describe, it, expect, beforeAll } from 'vitest'

const skip = process.env['SKIP_INTEGRATION'] === 'true'
import app from '../../index.js'
import { resetTestDb } from './globalSetup.js'

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}
async function register(email: string): Promise<{ token: string }> {
  const res = await app.request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123' }),
  })
  return { token: (await res.json()).token }
}

type Suggestion = {
  id: string
  title: string
  matchedCount: number
  totalCount: number
  missingIngredients: string[]
  goalFit: string | null
}

describe.skipIf(skip).sequential('Ingredient suggestions integration', () => {
  let user: { token: string }
  let fullId: string
  let partialId: string

  beforeAll(async () => {
    await resetTestDb()
    user = await register(`sugg-${Date.now()}@example.com`)

    const mk = async (title: string, ingredients: string[], nutrition?: object) =>
      (await (
        await app.request('/v1/recipes', {
          method: 'POST',
          headers: auth(user.token),
          body: JSON.stringify({
            title,
            servings: 1,
            category: 'Cena',
            ingredients: ingredients.map((name) => ({ name, quantity: 1, unit: 'unit' })),
            steps: [{ text: 'Cocinar.' }],
            ...(nutrition ? { nutrition } : {}),
          }),
        })
      ).json()) as { id: string }

    fullId = (
      await mk('Pollo solo', ['Pollo'], {
        calories: 480,
        protein_g: 40,
        carbs_g: 0,
        fat_g: 10,
      })
    ).id
    partialId = (await mk('Pollo con arroz', ['Pollo', 'Arroz'])).id
  })

  it('ranks recipes cookable from the ad-hoc ingredients first, with missing listed', async () => {
    const res = await app.request('/v1/suggestions/from-ingredients', {
      method: 'POST',
      headers: auth(user.token),
      body: JSON.stringify({ ingredients: ['pollo'] }),
    })
    expect(res.status).toBe(200)
    const list = (await res.json()) as Suggestion[]
    // "Pollo solo" is 1/1 cookable; "Pollo con arroz" is 1/2 (missing Arroz).
    expect(list.findIndex((r) => r.id === fullId)).toBeLessThan(
      list.findIndex((r) => r.id === partialId),
    )
    const partial = list.find((r) => r.id === partialId)!
    expect(partial.missingIngredients).toContain('Arroz')
    expect(list.every((r) => r.goalFit === null)).toBe(true) // no date → no goal
  })

  it('adds goalFit when a date is given and a nutrition target is set', async () => {
    await app.request('/auth/profile', {
      method: 'PATCH',
      headers: auth(user.token),
      body: JSON.stringify({
        nutritionTargets: {
          daily_calories: 500,
          daily_protein_g: 40,
          daily_carbs_g: 0,
          daily_fat_g: 10,
        },
      }),
    })
    const res = await app.request('/v1/suggestions/from-ingredients', {
      method: 'POST',
      headers: auth(user.token),
      body: JSON.stringify({ ingredients: ['pollo'], date: '2026-07-13' }),
    })
    const list = (await res.json()) as Suggestion[]
    // 480 kcal against a 500 kcal remaining goal → within.
    expect(list.find((r) => r.id === fullId)!.goalFit).toBe('dentro')
    // The recipe without nutrition keeps a null goalFit.
    expect(list.find((r) => r.id === partialId)!.goalFit).toBeNull()
  })

  it('400s when neither ingredients nor pantry are given', async () => {
    const res = await app.request('/v1/suggestions/from-ingredients', {
      method: 'POST',
      headers: auth(user.token),
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })
})
