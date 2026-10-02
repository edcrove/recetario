import { test, expect } from './fixtures'
import { authHeaders, createRecipeViaApi, deleteRecipeViaApi } from './api'
import { API_URL } from './env'

// 2026-10-02 review: every screen caches its reads for 30s, and an edit only
// refreshed its own screen, so going back (in-app, no reload) showed stale data:
// the day summary kept the old goal, the planner the old recipe title.

function localToday(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

test("a new daily goal shows in the planner's day summary right away", async ({ page }) => {
  const headers = await authHeaders(page)
  const today = localToday()
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
  const recipe = await createRecipeViaApi(page, {
    nutrition: { calories: 500, protein_g: 30, carbs_g: 50, fat_g: 15 },
  })
  await page.request.post(`${API_URL}/v1/menu`, {
    headers,
    data: { date: today, slot: 'Almuerzo', recipeId: recipe.id, servings: 1 },
  })
  try {
    await page.goto('/')
    await page.getByText('Menú Semanal').click()
    const summary = page.getByTestId(`day-nutrition-${today}`)
    await expect(summary.getByText('faltan 1500 kcal', { exact: true })).toBeVisible({
      timeout: 12000,
    })

    await page.goBack()
    await page.getByTestId('home-profile-button').click()
    await page.getByText('Mi perfil').click()
    const saved = page.waitForResponse(
      (r) => r.url().endsWith('/auth/profile') && r.request().method() === 'PATCH',
    )
    await page.getByTestId('target-daily_calories-plus').click()
    expect((await saved).ok()).toBe(true)

    await page.goBack()
    await page.getByText('Menú Semanal').click()
    await expect(summary.getByText('faltan 1600 kcal', { exact: true })).toBeVisible()
  } finally {
    await page.request.delete(`${API_URL}/v1/menu/${today}/Almuerzo/${recipe.id}`, { headers })
    await deleteRecipeViaApi(page, recipe.id)
  }
})

test('renaming a planned recipe renames it in the planner right away', async ({ page }) => {
  const headers = await authHeaders(page)
  const today = localToday()
  const recipe = await createRecipeViaApi(page)
  const renamed = `${recipe.title} renombrada`
  await page.request.post(`${API_URL}/v1/menu`, {
    headers,
    data: { date: today, slot: 'Cena', recipeId: recipe.id, servings: 2 },
  })
  try {
    await page.goto('/')
    await page.getByText('Menú Semanal').click()
    const chip = page.getByTestId(`menu-entry-${today}-Cena-${recipe.id}`)
    await expect(chip).toContainText(recipe.title)

    await page.goBack()
    await page.getByPlaceholder(/buscar recetas/i).fill(recipe.title)
    await page.getByText(recipe.title).first().click()
    await page.getByText('Editar').click()
    await page.getByPlaceholder('Nombre de la receta').fill(renamed)
    await page.getByText('Guardar Cambios').click()
    await expect(page).toHaveURL(new RegExp(`/recipe/${recipe.id}$`))
    await expect(page.getByText(renamed).filter({ visible: true })).toHaveCount(1)

    // Back to home in-app (detail ← home), then the planner
    await page.goBack()
    await page.getByText('Menú Semanal').click()
    await expect(chip).toContainText(renamed)
  } finally {
    await page.request.delete(`${API_URL}/v1/menu/${today}/Cena/${recipe.id}`, { headers })
    await deleteRecipeViaApi(page, recipe.id)
  }
})
