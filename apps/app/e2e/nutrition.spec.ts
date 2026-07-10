import { test, expect } from './fixtures'

/**
 * Nutrition goals E2E (nutrition epic stories 3+4). Everything created is
 * cleaned up so seeded data stays stable.
 */
const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000'

async function authHeaders(page: import('@playwright/test').Page) {
  const token = await page.evaluate(() => localStorage.getItem('auth_token'))
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

test('the macro strip shows per-serving macros on the pick screen', async ({ page }) => {
  const headers = await authHeaders(page)
  const res = await page.request.post(`${API_URL}/v1/recipes`, {
    headers,
    data: {
      title: `E2E Macros ${Date.now()}`,
      servings: 2,
      category: 'Cena',
      ingredients: [{ name: 'x', quantity: 1, unit: 'g' }],
      steps: [{ text: 'a' }],
      nutrition: { calories: 420, protein_g: 28, carbs_g: 52, fat_g: 12 },
    },
  })
  const recipe = (await res.json()) as { id: string; title: string }
  try {
    await page.goto('/menu/pick?date=2027-05-10&slot=Cena&weekStart=2027-05-10')
    await page.getByPlaceholder('Buscar receta...').fill(recipe.title)
    await expect(page.getByText('420 kcal · 28P · 52C · 12G').first()).toBeVisible({
      timeout: 10000,
    })
  } finally {
    await page.request.delete(`${API_URL}/v1/recipes/${recipe.id}`, { headers })
  }
})

test('per-meal calorie goals stepper works in the profile', async ({ page }) => {
  await page.goto('/profile')
  await expect(page.getByText('Objetivos por comida (calorías)')).toBeVisible({ timeout: 10000 })
  const row = page.getByText('Almuerzo', { exact: true }).locator('xpath=..')
  const before = Number(
    (await row.locator('text=/\\d+/').first().textContent())?.match(/\d+/)?.[0] ?? 0,
  )
  await page.getByTestId('meal-target-Almuerzo-plus').click()
  await expect(row.getByText(String(before + 50))).toBeVisible({ timeout: 8000 })
  await page.getByTestId('meal-target-Almuerzo-minus').click()
  await expect(row.getByText(String(before))).toBeVisible({ timeout: 8000 })
})

test('the planner shows a day nutrition summary with delta vs the goal', async ({ page }) => {
  const headers = await authHeaders(page)
  // ensure a daily target
  await page.request.patch(`${API_URL}/auth/profile`, {
    headers,
    data: {
      nutritionTargets: {
        daily_calories: 2000,
        daily_protein_g: 100,
        daily_carbs_g: 250,
        daily_fat_g: 70,
      },
    },
  })
  const res = await page.request.post(`${API_URL}/v1/recipes`, {
    headers,
    data: {
      title: `E2E DiaNutri ${Date.now()}`,
      servings: 2,
      category: 'Almuerzo',
      ingredients: [{ name: 'x', quantity: 1, unit: 'g' }],
      steps: [{ text: 'a' }],
      nutrition: { calories: 500, protein_g: 30, carbs_g: 50, fat_g: 15 },
    },
  })
  const recipe = (await res.json()) as { id: string }
  // A date in the CURRENT week (the planner defaults to today's week and
  // ignores query params). Use today so the day is guaranteed on screen.
  const date = new Date().toISOString().slice(0, 10)
  await page.request.post(`${API_URL}/v1/menu`, {
    headers,
    data: { date, slot: 'Almuerzo', recipeId: recipe.id, servings: 2 },
  })
  try {
    await page.goto('/menu')
    const summary = page.getByTestId(`day-nutrition-${date}`)
    await expect(summary).toBeVisible({ timeout: 12000 })
    await expect(summary.getByText(/1000 kcal/)).toBeVisible()
    await expect(summary.getByText(/faltan/)).toBeVisible()
  } finally {
    await page.request.delete(`${API_URL}/v1/menu/${date}/Almuerzo/${recipe.id}`, { headers })
    await page.request.delete(`${API_URL}/v1/recipes/${recipe.id}`, { headers })
  }
})
