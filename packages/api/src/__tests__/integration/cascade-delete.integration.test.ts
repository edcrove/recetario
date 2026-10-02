import { describe, it, expect, beforeAll } from 'vitest'

const skip = process.env['SKIP_INTEGRATION'] === 'true'
import app from '../../index.js'
import { TEST_API_KEY, resetTestDb } from './globalSetup.js'

const auth = `Bearer ${TEST_API_KEY}`

const baseRecipe = {
  title: 'Receta A Borrar',
  servings: 4,
  category: 'Cena' as const,
  ingredients: [{ name: 'pasta', quantity: 200, unit: 'g' as const }],
  steps: [{ text: 'Hervir' }],
}

// Regression suite for the 2026-07-03 audit finding: deleting a recipe used
// to cascade-delete cook history and menu-plan entries irreversibly. Now the
// FK sets recipeId to null instead, and a recipeTitle snapshot (taken when
// the row was created) keeps history readable.
describe
  .skipIf(skip)
  .sequential('Deleting a recipe preserves cook history and menu entries', () => {
    let recipeId: string

    beforeAll(async () => {
      await resetTestDb()

      const res = await app.request('/v1/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify(baseRecipe),
      })
      recipeId = (await res.json()).id

      // Log a cook session (with and without optional fields) and add a menu
      // entry, all referencing this recipe.
      await app.request('/v1/cook-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({ recipeId, rating: 5, notes: 'Quedó rica' }),
      })
      await app.request('/v1/cook-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({ recipeId }),
      })
      // A past dish (history), and two upcoming ones: one still planned, one
      // already marked skipped
      const plan = (date: string, slot: string) =>
        app.request('/v1/menu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: auth },
          body: JSON.stringify({ date, slot, recipeId, servings: 4 }),
        })
      await plan('2020-01-02', 'Cena')
      await plan('2030-01-04', 'Cena')
      await plan('2030-01-05', 'Almuerzo')
      await app.request(`/v1/menu/2030-01-05/Almuerzo/${recipeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({ status: 'skipped' }),
      })

      // Now delete the recipe itself.
      const deleteRes = await app.request(`/v1/recipes/${recipeId}`, {
        method: 'DELETE',
        headers: { Authorization: auth },
      })
      expect(deleteRes.status).toBe(204)
    })

    it('a past menu entry survives with recipeId null and the title snapshot intact', async () => {
      const res = await app.request('/v1/menu?weekStart=2019-12-30', {
        headers: { Authorization: auth },
      })
      const entries = (await res.json()) as Array<{
        recipeId: string | null
        recipeName?: string
      }>
      const orphaned = entries.find((e) => e.recipeName === 'Receta A Borrar')
      expect(orphaned).toBeDefined()
      expect(orphaned!.recipeId).toBeNull()
    })

    // 2026-10-02 review: the app's confirmation says the recipe "also leaves the
    // menu", but upcoming dishes stayed as unremovable "(eliminada)" chips.
    it('an upcoming planned dish leaves the menu; an upcoming skipped one stays as history', async () => {
      const res = await app.request('/v1/menu?weekStart=2029-12-31', {
        headers: { Authorization: auth },
      })
      const entries = (await res.json()) as Array<{ date: string; status: string }>
      expect(entries.map((e) => [e.date, e.status])).toEqual([['2030-01-05', 'skipped']])
    })

    it('the cook session survives and is counted in stats with recipeId null', async () => {
      const res = await app.request('/v1/cook-sessions/stats', {
        headers: { Authorization: auth },
      })
      const stats = await res.json()
      expect(stats.totalSessions).toBeGreaterThanOrEqual(1)
      const orphan = stats.topRecipes.find(
        (r: { recipeId: string | null; title: string | null }) => r.recipeId === null,
      )
      // The title snapshot keeps stats readable after the recipe is gone
      expect(orphan?.title).toBe('Receta A Borrar')
      expect(stats.since).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })
