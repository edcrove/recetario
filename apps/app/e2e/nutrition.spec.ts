import { test, expect } from './fixtures'
import { API_URL } from './env'
import { authHeaders } from './api'

/**
 * Nutrition goals E2E (nutrition epic stories 3+4). Everything created is
 * cleaned up so seeded data stays stable.
 */

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
    await expect(page.getByText('420 kcal · 28P · 52C · 12G').first()).toBeVisible()
  } finally {
    await page.request.delete(`${API_URL}/v1/recipes/${recipe.id}`, { headers })
  }
})

test('per-meal calorie goals stepper works in the profile', async ({ page }) => {
  await page.goto('/profile')
  await expect(page.getByText('Objetivos por comida (calorías)')).toBeVisible()
  const row = page.getByText('Almuerzo', { exact: true }).locator('xpath=..')
  const before = Number(
    (await row.locator('text=/\\d+/').first().textContent())?.match(/\d+/)?.[0] ?? 0,
  )
  await page.getByTestId('meal-target-Almuerzo-plus').click()
  await expect(row.getByText(String(before + 50))).toBeVisible()
  await page.getByTestId('meal-target-Almuerzo-minus').click()
  await expect(row.getByText(String(before))).toBeVisible()
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
    // Per person: one 500 kcal portion, although 2 servings are planned
    await expect(summary.getByText(/Por persona: 500 kcal/)).toBeVisible()
    await expect(summary.getByText(/faltan/)).toBeVisible()
  } finally {
    await page.request.delete(`${API_URL}/v1/menu/${date}/Almuerzo/${recipe.id}`, { headers })
    await page.request.delete(`${API_URL}/v1/recipes/${recipe.id}`, { headers })
  }
})

test('the planner day summary flags datos incompletos with a mixed day', async ({ page }) => {
  const headers = await authHeaders(page)
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
  const withN = await page.request.post(`${API_URL}/v1/recipes`, {
    headers,
    data: {
      title: `E2E Parcial A ${Date.now()}`,
      servings: 2,
      category: 'Almuerzo',
      ingredients: [{ name: 'x', quantity: 1, unit: 'g' }],
      steps: [{ text: 'a' }],
      nutrition: { calories: 500, protein_g: 30, carbs_g: 50, fat_g: 15 },
    },
  })
  const noN = await page.request.post(`${API_URL}/v1/recipes`, {
    headers,
    data: {
      title: `E2E Parcial B ${Date.now()}`,
      servings: 2,
      category: 'Cena',
      ingredients: [{ name: 'y', quantity: 1, unit: 'g' }],
      steps: [{ text: 'b' }],
    },
  })
  const a = (await withN.json()) as { id: string }
  const b = (await noN.json()) as { id: string }
  const date = new Date().toISOString().slice(0, 10)
  await page.request.post(`${API_URL}/v1/menu`, {
    headers,
    data: { date, slot: 'Almuerzo', recipeId: a.id, servings: 1 },
  })
  await page.request.post(`${API_URL}/v1/menu`, {
    headers,
    data: { date, slot: 'Cena', recipeId: b.id, servings: 1 },
  })
  try {
    await page.goto('/menu')
    const summary = page.getByTestId(`day-nutrition-${date}`)
    await expect(summary).toBeVisible({ timeout: 12000 })
    await expect(summary.getByText('datos incompletos')).toBeVisible()
  } finally {
    await page.request.delete(`${API_URL}/v1/menu/${date}/Almuerzo/${a.id}`, { headers })
    await page.request.delete(`${API_URL}/v1/menu/${date}/Cena/${b.id}`, { headers })
    await page.request.delete(`${API_URL}/v1/recipes/${a.id}`, { headers })
    await page.request.delete(`${API_URL}/v1/recipes/${b.id}`, { headers })
  }
})

test('planning a dish from the app refreshes the day summary without a reload', async ({
  page,
}) => {
  const headers = await authHeaders(page)
  const res = await page.request.post(`${API_URL}/v1/recipes`, {
    headers,
    data: {
      title: `E2E Refresco ${Date.now()}`,
      servings: 2,
      category: 'Snack',
      ingredients: [{ name: 'x', quantity: 1, unit: 'g' }],
      nutrition: { calories: 333, protein_g: 3, carbs_g: 3, fat_g: 3 },
    },
  })
  const recipe = (await res.json()) as { id: string; title: string }
  const now = new Date()
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
  try {
    await page.goto('/menu')
    await page.getByTestId(`menu-add-${today}-Merienda`).click()
    await page.getByPlaceholder('Buscar receta...').fill(recipe.title)
    await page.getByTestId(`pick-recipe-${recipe.id}`).click()
    // Back on the planner (client-side): the summary includes the new dish
    await expect(page.getByTestId(`day-nutrition-${today}`)).toContainText(/kcal/)
    const day = (await (
      await page.request.get(`${API_URL}/v1/menu/day-nutrition?date=${today}`, { headers })
    ).json()) as { totals: { calories: number } }
    await expect(page.getByTestId(`day-nutrition-${today}`)).toContainText(
      `${day.totals.calories} kcal`,
    )
  } finally {
    await page.request.delete(`${API_URL}/v1/menu/${today}/Merienda/${recipe.id}`, { headers })
    await page.request.delete(`${API_URL}/v1/recipes/${recipe.id}`, { headers })
  }
})

// 2026-10-01 audit (Nutrition): sugars, saturated fat and sodium when known.
test('recipe detail lists sugars, saturated fat and sodium when the recipe has them', async ({
  page,
}) => {
  const headers = await authHeaders(page)
  const res = await page.request.post(`${API_URL}/v1/recipes`, {
    headers,
    data: {
      title: `E2E Sodio ${Date.now()}`,
      servings: 2,
      category: 'Cena',
      ingredients: [{ name: 'sal', quantity: 1, unit: 'g' }],
      nutrition: {
        calories: 300,
        protein_g: 10,
        carbs_g: 40,
        fat_g: 8,
        sugars_g: 12,
        saturated_fat_g: 3.5,
        sodium_mg: 480,
      },
    },
  })
  const recipe = (await res.json()) as { id: string }
  try {
    await page.goto(`/recipe/${recipe.id}`)
    await expect(page.getByTestId('nutrition-extras').first()).toHaveText(
      'Azúcares 12 g · Grasas sat. 3.5 g · Sodio 480 mg',
    )
  } finally {
    await page.request.delete(`${API_URL}/v1/recipes/${recipe.id}`, { headers })
  }
})

// Story "goals in Perfil + day progress/delta in planner": "Pick screen with
// goals set: projected delta preview ('con esta receta el almuerzo queda en
// 780 / 700 kcal')". A fresh account, so the demo profile's goals stay as seeded.
test('with a lunch goal the pick screen previews where lunch lands, per recipe', async ({
  page,
}) => {
  const email = `e2e-preview-${Date.now()}@example.com`
  const reg = await page.request.post(`${API_URL}/auth/register`, {
    data: { email, password: 'preview1234' },
  })
  const { token } = (await reg.json()) as { token: string }
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  await page.request.patch(`${API_URL}/auth/profile`, {
    headers,
    data: {
      nutritionTargets: {
        daily_calories: 2000,
        daily_protein_g: 0,
        daily_carbs_g: 0,
        daily_fat_g: 0,
        per_meal: { Almuerzo: { calories: 700 } },
      },
    },
  })
  const make = async (title: string, calories: number) =>
    (await (
      await page.request.post(`${API_URL}/v1/recipes`, {
        headers,
        data: {
          title,
          servings: 2,
          category: 'Almuerzo',
          ingredients: [{ name: 'x', quantity: 1, unit: 'g' }],
          steps: [{ text: 'a' }],
          nutrition: { calories, protein_g: 10, carbs_g: 10, fat_g: 10 },
        },
      })
    ).json()) as { id: string }
  const starter = await make('Entrada preview', 300)
  const heavy = await make('Guiso preview', 480)
  const light = await make('Ensalada preview', 350)
  // Lunch already has a 300 kcal starter planned
  const date = '2027-06-08'
  await page.request.post(`${API_URL}/v1/menu`, {
    headers,
    data: { date, slot: 'Almuerzo', recipeId: starter.id, servings: 2 },
  })

  await page.evaluate((jwt) => localStorage.setItem('auth_token', jwt), token)
  await page.goto(`/menu/pick?date=${date}&slot=Almuerzo&weekStart=2027-06-07`)
  const over = page.getByTestId(`pick-projection-${heavy.id}`)
  const ok = page.getByTestId(`pick-projection-${light.id}`)
  // The AC's own example: 300 planned + 480 = 780 against a 700 goal
  await expect(over).toHaveText('Con esta receta el almuerzo queda en 780 / 700 kcal')
  await expect(ok).toHaveText('Con esta receta el almuerzo queda en 650 / 700 kcal')
  // Over the goal reads in a different colour than on-track
  const colour = (id: string) =>
    page.getByTestId(`pick-projection-${id}`).evaluate((el) => getComputedStyle(el).color)
  expect(await colour(heavy.id)).not.toBe(await colour(light.id))

  // Picking it plans it: lunch now lands exactly where the preview said
  await page.getByTestId(`pick-recipe-${heavy.id}`).click()
  const lunch = async () => {
    const res = await page.request.get(`${API_URL}/v1/menu/day-nutrition?date=${date}`, {
      headers,
    })
    const body = (await res.json()) as {
      byMeal: { mealCategory: string; totals: { calories: number }; calorieDelta: number }[]
    }
    const meal = body.byMeal.find((m) => m.mealCategory === 'Almuerzo')
    return meal ? `${meal.totals.calories}|${meal.calorieDelta}` : null
  }
  await expect.poll(lunch).toBe('780|80')
})
