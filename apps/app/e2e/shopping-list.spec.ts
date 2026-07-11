import { test, expect } from './fixtures'
import type { APIRequestContext } from '@playwright/test'

// Shopping list v2 (story 2): items group by aisle, check-off is optimistic and
// persists server-side. Seeds a recipe + menu entry per week via the API.
const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000'

async function seedWeek(request: APIRequestContext, headers: Record<string, string>, week: string) {
  const recipeRes = await request.post(`${API_URL}/v1/recipes`, {
    headers,
    data: {
      title: `E2E Compras ${Date.now()}`,
      servings: 2,
      category: 'Cena',
      ingredients: [{ name: 'harina', quantity: 500, unit: 'g' }],
      steps: [{ text: 'Mezclar.' }],
    },
  })
  expect(recipeRes.ok()).toBe(true)
  const recipe = (await recipeRes.json()) as { id: string }
  const menuRes = await request.post(`${API_URL}/v1/menu`, {
    headers,
    data: { date: week, slot: 'Cena', recipeId: recipe.id, servings: 2 },
  })
  expect(menuRes.ok()).toBe(true)
  // Normalize starting state (a prior local run may have left a check behind).
  await request.put(`${API_URL}/v1/menu/shopping-list/check`, {
    headers,
    data: { weekStart: week, key: 'harina', checked: false },
  })
  return recipe.id
}

async function cleanup(
  request: APIRequestContext,
  headers: Record<string, string>,
  week: string,
  recipeId: string,
) {
  await request.put(`${API_URL}/v1/menu/shopping-list/check`, {
    headers,
    data: { weekStart: week, key: 'harina', checked: false },
  })
  await request.delete(`${API_URL}/v1/menu/${week}/Cena`, { headers })
  await request.delete(`${API_URL}/v1/recipes/${recipeId}`, { headers })
}

test('checking a shopping-list item persists across a reload', async ({ page }) => {
  const token = await page.evaluate(() => localStorage.getItem('auth_token'))
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const week = '2027-03-01' // a Monday clear of other specs' weeks
  const recipeId = await seedWeek(page.request, headers, week)

  try {
    await page.goto(`/menu/shopping-list?weekStart=${week}`)
    const row = page.getByTestId('shopping-item-harina')
    await expect(row).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('shopping-progress')).toHaveText('0 / 1')

    await row.click()
    await expect(page.getByTestId('shopping-progress')).toHaveText('1 / 1')

    // Reload — the check came from the server, so it must still be there.
    await page.reload()
    await expect(page.getByTestId('shopping-progress')).toHaveText('1 / 1', { timeout: 10000 })
    await expect(page.getByTestId('shopping-item-harina').getByText('✓')).toBeVisible()
  } finally {
    await cleanup(page.request, headers, week, recipeId)
  }
})

test('optimistic tick is applied on click and rolled back when the request fails', async ({
  page,
}) => {
  const token = await page.evaluate(() => localStorage.getItem('auth_token'))
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const week = '2027-03-08' // distinct week so it can't collide with the reload test
  const recipeId = await seedWeek(page.request, headers, week)

  try {
    await page.goto(`/menu/shopping-list?weekStart=${week}`)
    const row = page.getByTestId('shopping-item-harina')
    await expect(row).toBeVisible({ timeout: 10000 })

    // Successful check: optimistic tick sticks (no reload, so this coverage is kept).
    await row.click()
    await expect(page.getByTestId('shopping-progress')).toHaveText('1 / 1')
    await expect(row.getByText('✓')).toBeVisible()

    // Failing uncheck: intercept the PUT so it errors; the optimistic flip to
    // 0/1 must roll back to 1/1.
    await page.route('**/menu/shopping-list/check', (r) => r.abort())
    await row.click()
    await expect(page.getByTestId('shopping-progress')).toHaveText('1 / 1', { timeout: 10000 })
    await page.unroute('**/menu/shopping-list/check')
  } finally {
    await cleanup(page.request, headers, week, recipeId)
  }
})
