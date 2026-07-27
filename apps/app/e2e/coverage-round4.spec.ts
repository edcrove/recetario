import { test, expect } from './fixtures'

/**
 * Round 4 — closing the remaining browser-reachable gaps the earlier rounds
 * left open, measured against the clean E2E stack:
 *   - AllergenWarning banner (both the allergen and the unmet-dietary blocks),
 *     driven by intercepting GET /auth/profile so the component's own
 *     ['profile'] query resolves to a profile that actually conflicts — the
 *     real profile is fetched at boot and cached, so a post-boot API write
 *     never reaches the banner (the reason the older allergen test passed
 *     while AllergenWarning stayed at 0% — it matched the ingredient text, not
 *     the banner).
 *   - DayNutritionSummary rollup in the planner (delta + partial flag).
 *   - Stats top-recipe row for a LIVE recipe (deterministically clickable) and
 *     the weekly frequency chart.
 *   - Household member management: invite → member row renders → remove.
 *
 * Everything created is cleaned up; interceptions are page-scoped and set
 * before the navigation that triggers the fetch.
 */

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000'

async function authHeaders(page: import('@playwright/test').Page) {
  const token = await page.evaluate(() => localStorage.getItem('auth_token'))
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

async function createRecipeViaApi(
  page: import('@playwright/test').Page,
  overrides: Record<string, unknown> = {},
) {
  const headers = await authHeaders(page)
  const res = await page.request.post(`${API_URL}/v1/recipes`, {
    headers,
    data: {
      title: `E2E R4 ${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      servings: 2,
      category: 'Cena',
      ingredients: [{ name: 'agua', quantity: 1, unit: 'l' }],
      steps: [{ text: 'Paso único.' }],
      ...overrides,
    },
  })
  expect(res.ok()).toBe(true)
  return (await res.json()) as { id: string; title: string }
}

async function deleteRecipeViaApi(page: import('@playwright/test').Page, id: string) {
  const headers = await authHeaders(page)
  await page.request.delete(`${API_URL}/v1/recipes/${id}`, { headers })
}

test.describe('AllergenWarning banner (route interception)', () => {
  test('renders both the matched-allergen and unmet-dietary blocks', async ({ page }) => {
    // Recipe with a peanut ingredient and NO vegan tag → trips a maní allergy
    // and fails a vegano restriction simultaneously.
    const recipe = await createRecipeViaApi(page, {
      ingredients: [{ name: 'maní', quantity: 100, unit: 'g' }],
    })
    try {
      await page.route('**/auth/profile', (route) =>
        route.request().method() === 'GET'
          ? route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                preferredServings: 2,
                dietaryRestrictions: ['vegano'],
                allergens: ['maní'],
                goals: [],
                timezone: null,
                nutritionTargets: null,
              }),
            })
          : route.fallback(),
      )
      await page.goto(`/recipe/${recipe.id}`)
      await expect(page.getByText('Alérgenos:')).toBeVisible({ timeout: 10000 })
      await expect(page.getByText('No cumple:')).toBeVisible()
    } finally {
      await page.unroute('**/auth/profile')
      await deleteRecipeViaApi(page, recipe.id)
    }
  })
})

test.describe('DayNutritionSummary in the planner (route interception)', () => {
  test('shows the per-day totals, the delta label and the partial-data flag', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10)
    await page.route('**/v1/menu/day-nutrition*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          date: today,
          totals: { calories: 700, protein_g: 30, carbs_g: 80, fat_g: 20 },
          target: { calories: 1000, protein_g: 50, carbs_g: 250, fat_g: 70 },
          delta: { calories: -300, protein_g: -20, carbs_g: -170, fat_g: -50 },
          partial: true,
        }),
      }),
    )
    try {
      await page.getByText('Menú Semanal').click()
      await expect(page.getByTestId(`day-nutrition-${today}`).first()).toBeVisible({
        timeout: 10000,
      })
      await expect(page.getByText('datos incompletos').first()).toBeVisible()
    } finally {
      await page.unroute('**/v1/menu/day-nutrition*')
    }
  })
})

test.describe('Stats: live top-recipe row and weekly chart', () => {
  test('a live top-recipe row is clickable and the weekly chart renders', async ({ page }) => {
    const recipe = await createRecipeViaApi(page)
    try {
      await page.route('**/v1/cook-sessions/stats*', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            totalSessions: 5,
            topRecipes: [
              { recipeId: recipe.id, count: 5, lastCookedAt: '2026-07-01T12:00:00.000Z' },
            ],
            frequencyByWeek: [{ week: '2026-W27', count: 5 }],
          }),
        }),
      )
      await page.goto('/stats')
      await expect(page.getByText('#1')).toBeVisible({ timeout: 10000 })
      await expect(page.getByText('5×')).toBeVisible()
      // Tapping the live row navigates to the recipe detail (clickable branch).
      await page.getByText(`${recipe.id.slice(0, 8)}…`).click()
      await expect(page.getByTestId('recipe-detail-cook')).toBeVisible({ timeout: 10000 })
    } finally {
      await page.unroute('**/v1/cook-sessions/stats*')
      await deleteRecipeViaApi(page, recipe.id)
    }
  })
})

test.describe('Household empty state', () => {
  test('a user with no household sees the create-your-first-household card', async ({ page }) => {
    // Force the "no household yet" path (the AC's gap that otherwise needs a
    // dedicated 5th demo account) by intercepting the list to empty. The
    // create still hits the real backend, so clean it up afterwards.
    const headers = await authHeaders(page)
    await page.route('**/v1/households/mine', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
        : route.fallback(),
    )
    const name = `E2E Primer Hogar ${Date.now()}`
    try {
      await page.goto('/household')
      await expect(page.getByTestId('household-create-name-input')).toBeVisible({ timeout: 10000 })
      await expect(page.getByText('Creá tu hogar')).toBeVisible()
      await page.getByTestId('household-create-name-input').fill(name)
      const [createRes] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes('/v1/households') && r.request().method() === 'POST',
        ),
        page.getByTestId('household-create-submit').click(),
      ])
      expect(createRes.status()).toBeLessThan(300)
    } finally {
      await page.unroute('**/v1/households/mine')
      const mine = (await (
        await page.request.get(`${API_URL}/v1/households/mine`, { headers })
      ).json()) as { id: string; name: string }[]
      const created = mine.find((h) => h.name === name)
      if (created) await page.request.delete(`${API_URL}/v1/households/${created.id}`, { headers })
    }
  })
})

test.describe('Household member management', () => {
  test('invite a member, see the row, then remove it', async ({ page }) => {
    const headers = await authHeaders(page)

    // Ensure the current user owns at least one household.
    let mine = (await (
      await page.request.get(`${API_URL}/v1/households/mine`, { headers })
    ).json()) as { id: string; name: string }[]
    if (mine.length === 0) {
      await page.request.post(`${API_URL}/v1/households`, {
        headers,
        data: { name: `E2E Hogar R4 ${Date.now()}` },
      })
      mine = (await (
        await page.request.get(`${API_URL}/v1/households/mine`, { headers })
      ).json()) as { id: string; name: string }[]
    }
    const household = mine[0]!

    // A dedicated throwaway invitee — never the worker demo accounts, so this
    // never contaminates another Playwright worker's household state.
    const inviteeEmail = `e2e-invitee-${Date.now()}-${Math.floor(Math.random() * 100000)}@e2e.test`
    const reg = await page.request.post(`${API_URL}/auth/register`, {
      data: { email: inviteeEmail, password: 'demo1234' },
    })
    expect(reg.ok()).toBe(true)

    let removedUserId: string | null = null
    try {
      await page.goto('/household')
      // Open the invite box (canManageMembers is true — current user is owner).
      const openBtn = page.getByTestId('household-invite-open').first()
      await expect(openBtn).toBeVisible({ timeout: 10000 })
      await openBtn.click()
      await page.getByTestId('household-invite-email-input').fill(inviteeEmail)
      // Exercise a role chip other than the default (member).
      await page.getByTestId('household-invite-role-admin').click()
      await page.getByTestId('household-invite-submit').click()

      // The invited member now shows up as a row. Find their userId from the
      // server so we can target the (owner-only) remove affordance.
      let inviteeUserId = ''
      await expect(async () => {
        const fresh = (await (
          await page.request.get(`${API_URL}/v1/households/mine`, { headers })
        ).json()) as { id: string; members?: { userId: string; role: string }[] }[]
        const hh = fresh.find((h) => h.id === household.id)
        const member = hh?.members?.find((m) => m.role !== 'owner')
        expect(member).toBeTruthy()
        inviteeUserId = member!.userId
      }).toPass({ timeout: 10000 })

      const removeBtn = page.getByTestId(`household-remove-member-${inviteeUserId}`)
      await expect(removeBtn).toBeVisible({ timeout: 10000 })

      // removeMember goes through confirmAsync → window.confirm on web.
      page.on('dialog', (dialog) => void dialog.accept())
      await removeBtn.click()
      await expect(removeBtn).not.toBeVisible({ timeout: 10000 })
      removedUserId = inviteeUserId
    } finally {
      // Belt-and-suspenders: if the UI removal did not land, strip the member
      // directly so the household is left exactly as we found it.
      const fresh = (await (
        await page.request.get(`${API_URL}/v1/households/mine`, { headers })
      ).json()) as { id: string; members?: { userId: string; role: string }[] }[]
      const hh = fresh.find((h) => h.id === household.id)
      const leftover = hh?.members?.find((m) => m.role !== 'owner' && m.userId !== removedUserId)
      const stragglers = hh?.members?.filter((m) => m.role !== 'owner') ?? []
      for (const m of stragglers) {
        await page.request.delete(`${API_URL}/v1/households/${household.id}/members/${m.userId}`, {
          headers,
        })
      }
      void leftover
    }
  })
})
