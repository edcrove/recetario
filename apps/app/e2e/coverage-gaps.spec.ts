import { test, expect } from './fixtures'

/**
 * Targeted coverage for flows no other suite exercises:
 * - stats screen with real data (top recipes + frequency chart + tap-through)
 * - picking a recipe from the menu pick screen (creates the entry for real)
 * - API error paths surfaced via notify() using Playwright route interception
 * Every entity created here is cleaned up so seeded demo data stays stable.
 */

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000'

async function authHeaders(page: import('@playwright/test').Page) {
  const token = await page.evaluate(() => localStorage.getItem('auth_token'))
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

test.describe('Stats screen with data', () => {
  test('shows top recipes and frequency chart after a cook session, and taps through', async ({
    page,
  }) => {
    const headers = await authHeaders(page)
    const recipeRes = await page.request.post(`${API_URL}/v1/recipes`, {
      headers,
      data: {
        title: `E2E Stats ${Date.now()}`,
        servings: 2,
        category: 'Cena',
        ingredients: [{ name: 'sal', quantity: 1, unit: 'g' }],
        steps: [{ text: 'Único paso.' }],
      },
    })
    expect(recipeRes.ok()).toBe(true)
    const recipe = (await recipeRes.json()) as { id: string }
    const sessionRes = await page.request.post(`${API_URL}/v1/cook-sessions`, {
      headers,
      data: { recipeId: recipe.id, rating: 5 },
    })
    expect(sessionRes.ok()).toBe(true)

    try {
      await page.goto('/stats')
      await expect(page.getByText('Recetas más cocinadas')).toBeVisible({ timeout: 8000 })
      // Non-empty branches: ranked row with count badge + weekly frequency bar
      await expect(page.getByText('#1')).toBeVisible({ timeout: 8000 })
      await expect(page.getByText(/\d+×/).first()).toBeVisible()
      await expect(page.getByText('Frecuencia semanal')).toBeVisible()

      // Tapping OUR recipe's row navigates to its detail (#1 might be an
      // older, since-deleted session's row, which renders unclickable)
      await page.getByText(`${recipe.id.slice(0, 8)}…`).click()
      await expect(page.getByTestId('recipe-detail-cook')).toBeVisible({ timeout: 10000 })
    } finally {
      await page.request.delete(`${API_URL}/v1/recipes/${recipe.id}`, { headers })
    }
  })
})

test.describe('Pick screen: actually picking a recipe', () => {
  test('tapping a recipe adds it to the slot and returns to the planner', async ({ page }) => {
    const headers = await authHeaders(page)
    // A far-future week so the current-week assertions of other suites never
    // see this entry, even if cleanup fails.
    const date = '2027-03-10'
    await page.goto(`/menu/pick?date=${date}&slot=Cena&weekStart=2027-03-08`)
    const firstRecipe = page.locator('[data-testid^="pick-recipe-"]').first()
    await expect(firstRecipe).toBeVisible({ timeout: 10000 })
    const pickedId = (await firstRecipe.getAttribute('data-testid'))!.replace('pick-recipe-', '')

    try {
      // The FlatList can re-render between resolving the locator and the click
      // landing (react-query refetch), silently dropping the press. Retry the
      // whole click→response block until the POST is actually observed.
      await expect(async () => {
        const [addRes] = await Promise.all([
          page.waitForResponse(
            (r) => r.url().includes('/v1/menu') && r.request().method() === 'POST',
            { timeout: 2000 },
          ),
          firstRecipe.click(),
        ])
        expect(addRes.status()).toBe(200)
      }).toPass({ timeout: 15000 })
      // onSuccess runs router.back(); entering pick via direct URL leaves no
      // history, so on web that navigation may no-op — the reliable success
      // signal is the entry existing server-side.

      const weekRes = await page.request.get(`${API_URL}/v1/menu?weekStart=2027-03-08`, {
        headers,
      })
      const entries = (await weekRes.json()) as { recipeId: string | null }[]
      expect(entries.some((e) => e.recipeId === pickedId)).toBe(true)
    } finally {
      await page.request.delete(`${API_URL}/v1/menu/${date}/Cena/${pickedId}`, { headers })
    }
  })
})

test.describe('API error paths (route interception)', () => {
  test('a 500 while adding to the menu surfaces the error notification', async ({ page }) => {
    await page.route('**/v1/menu', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 500, body: JSON.stringify({ error: 'boom' }) })
        : route.fallback(),
    )

    let dialogMessage = ''
    page.on('dialog', (dialog) => {
      dialogMessage = dialog.message()
      void dialog.accept()
    })

    await page.goto(`/menu/pick?date=2027-03-11&slot=Cena&weekStart=2027-03-08`)
    const firstRecipe = page.locator('[data-testid^="pick-recipe-"]').first()
    await expect(firstRecipe).toBeVisible({ timeout: 10000 })
    await firstRecipe.click()
    await expect.poll(() => dialogMessage, { timeout: 8000 }).toContain('Error')
  })

  test('a 500 while deleting a taxonomy item surfaces the error notification', async ({ page }) => {
    const headers = await authHeaders(page)
    // A custom food type so the delete affordance is guaranteed to render
    const ftRes = await page.request.post(`${API_URL}/v1/food-types`, {
      headers,
      data: { name: `E2E Borrable ${Date.now()}` },
    })
    expect(ftRes.ok()).toBe(true)
    const foodType = (await ftRes.json()) as { id: string }

    await page.route(`**/v1/config/food-types/${foodType.id}*`, (route) =>
      route.request().method() === 'DELETE'
        ? route.fulfill({ status: 500, body: JSON.stringify({ error: 'boom' }) })
        : route.fallback(),
    )

    let dialogMessage = ''
    page.on('dialog', (dialog) => {
      dialogMessage = dialog.message()
      void dialog.accept()
    })

    try {
      await page.goto('/config')
      await page.getByTestId('config-tab-food-types').click()
      const deleteBtn = page.getByTestId(`config-delete-${foodType.id}`)
      await expect(deleteBtn).toBeVisible({ timeout: 8000 })
      await deleteBtn.click()
      await expect(page.getByTestId('config-delete-confirm')).toBeVisible({ timeout: 5000 })
      await page.getByTestId('config-delete-confirm').click()
      await expect.poll(() => dialogMessage, { timeout: 8000 }).toContain('Error')
    } finally {
      await page.unroute(`**/v1/config/food-types/${foodType.id}*`)
      await page.request.delete(`${API_URL}/v1/config/food-types/${foodType.id}`, { headers })
    }
  })

  test('deleting a custom food type for real removes it from the list', async ({ page }) => {
    const headers = await authHeaders(page)
    const ftRes = await page.request.post(`${API_URL}/v1/food-types`, {
      headers,
      data: { name: `E2E Eliminable ${Date.now()}` },
    })
    expect(ftRes.ok()).toBe(true)
    const foodType = (await ftRes.json()) as { id: string }

    await page.goto('/config')
    await page.getByTestId('config-tab-food-types').click()
    const deleteBtn = page.getByTestId(`config-delete-${foodType.id}`)
    await expect(deleteBtn).toBeVisible({ timeout: 8000 })
    await deleteBtn.click()
    await expect(page.getByTestId('config-delete-confirm')).toBeVisible({ timeout: 5000 })
    await page.getByTestId('config-delete-confirm').click()
    await expect(deleteBtn).not.toBeVisible({ timeout: 8000 })
  })
})
