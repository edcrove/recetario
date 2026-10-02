import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'
import { API_URL } from './env'
import { authHeaders, createRecipeViaApi, deleteRecipeViaApi } from './api'

async function goToMenu(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByText('Menú Semanal').click()
  await expect(page).toHaveURL(/\/menu/)
}

test.describe('Weekly menu planner (/menu)', () => {
  test('navigates to weekly menu from home', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Menú Semanal')).toBeVisible({ timeout: 15000 })
    await page.getByText('Menú Semanal').click()
    await expect(page).toHaveURL(/\/menu/)
  })

  test('shows week navigation controls', async ({ page }) => {
    await goToMenu(page)
    await expect(page.getByText('‹ Anterior')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Siguiente ›')).toBeVisible()
  })

  test('shows Lista de compras button', async ({ page }) => {
    await goToMenu(page)
    await expect(page.getByText('Lista de compras')).toBeVisible({ timeout: 15000 })
  })

  test('shows 5 meal slots per day', async ({ page }) => {
    await goToMenu(page)
    await expect(page.getByText('Desayuno', { exact: true }).first()).toBeVisible({
      timeout: 15000,
    })
    for (const slot of ['Desayuno', 'Almuerzo', 'Merienda', 'Cena', 'Snacks/Otros']) {
      await expect(page.getByText(slot, { exact: true }).first()).toBeVisible()
    }
  })

  test('empty state shows + Agregar buttons', async ({ page }) => {
    await goToMenu(page)
    // Every slot offers + Agregar to a non-viewer, planned or not
    await expect(page.locator('[data-testid^="menu-add-"]').first()).toBeVisible({
      timeout: 15000,
    })
  })

  test('navigates to next week and back', async ({ page }) => {
    await goToMenu(page)
    await expect(page.getByText('‹ Anterior')).toBeVisible({ timeout: 15000 })

    const nextBtn = page.getByText('Siguiente ›')
    const prevBtn = page.getByText('‹ Anterior')
    const weekLabel = page.getByTestId('menu-week-label')
    const initialText = await weekLabel.textContent()

    await nextBtn.click()
    await expect(async () => {
      expect(await weekLabel.textContent()).not.toBe(initialText)
    }).toPass()

    await prevBtn.click()
    await expect(async () => {
      expect(await weekLabel.textContent()).toBe(initialText)
    }).toPass()
  })
})

test.describe('Pick recipe screen (/menu/pick)', () => {
  test('opens pick recipe screen from an empty slot', async ({ page }) => {
    await goToMenu(page)
    await expect(page.getByText('+ Agregar').first()).toBeVisible({ timeout: 15000 })
    await page.getByText('+ Agregar').first().click()
    await expect(page).toHaveURL(/\/menu\/pick/)
  })

  test('shows slot · date separator in header', async ({ page }) => {
    await goToMenu(page)
    await expect(page.getByText('+ Agregar').first()).toBeVisible({ timeout: 15000 })
    await page.getByText('+ Agregar').first().click()
    await expect(page).toHaveURL(/\/menu\/pick/)
    await expect(page.getByTestId('pick-header-slot-date')).toBeVisible()
    await expect(page.getByTestId('pick-header-slot-date')).toContainText('·')
  })

  test('shows search input and porciones field', async ({ page }) => {
    await page.goto('/menu/pick?date=2025-01-06&slot=Almuerzo&weekStart=2025-01-06')
    await expect(page.getByPlaceholder('Buscar receta...')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Porciones:')).toBeVisible()
  })

  test("lists the account's recipes to pick from", async ({ page }) => {
    await page.goto('/menu/pick?date=2025-01-06&slot=Almuerzo&weekStart=2025-01-06')
    // Demo accounts are seeded with recipes, so the list (not the empty state) shows
    await page.getByPlaceholder('Buscar receta...').fill('Guiso de lentejas')
    await expect(page.locator('[data-testid^="pick-recipe-"]')).toHaveCount(1)
    await expect(page.getByText('No hay recetas aún')).toHaveCount(0)
  })

  test('search filters recipe list', async ({ page }) => {
    await page.goto('/menu/pick?date=2025-01-06&slot=Almuerzo&weekStart=2025-01-06')
    const searchInput = page.getByPlaceholder('Buscar receta...')
    await expect(searchInput).toBeVisible({ timeout: 15000 })
    await searchInput.fill('zzznomatch')
    await expect(page.getByText('Sin resultados')).toBeVisible()
  })

  test('servings stepper increments the value', async ({ page }) => {
    await page.goto('/menu/pick?date=2025-01-06&slot=Almuerzo&weekStart=2025-01-06')
    await expect(page.getByText('Porciones:')).toBeVisible()
    const plusBtn = page.getByText('+', { exact: true }).first()
    const initial = await page.getByText(/^\d+$/).first().textContent()
    await plusBtn.click()
    await expect(async () => {
      const current = await page.getByText(/^\d+$/).first().textContent()
      expect(current).not.toBe(initial)
    }).toPass()
  })

  // Regression test for the 2026-07-03 audit finding (parent/family persona):
  // the allergen warning only showed up on the recipe detail page, three taps
  // deep from where planning actually happens. Now the picker shows a badge.
  test('shows an allergen badge on recipes that conflict with the profile', async ({ page }) => {
    const token = await page.evaluate(() => localStorage.getItem('auth_token'))
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    const res = await page.request.patch(`${API_URL}/auth/profile`, {
      headers,
      data: { allergens: ['leche'] },
    })
    expect(res.ok()).toBe(true)
    try {
      await page.goto('/menu/pick?date=2025-01-06&slot=Almuerzo&weekStart=2025-01-06')
      await expect(page.getByPlaceholder('Buscar receta...')).toBeVisible({ timeout: 15000 })
      await page.getByPlaceholder('Buscar receta...').fill('Tarta')
      await expect(page.getByTestId('allergen-badge').first()).toBeVisible()
    } finally {
      // Leave the account's allergens as found, or later profile tests see 'leche'
      await page.request.patch(`${API_URL}/auth/profile`, { headers, data: { allergens: [] } })
    }
  })
})

test.describe('Shopping list screen (/menu/shopping-list)', () => {
  test('navigates to shopping list from menu planner', async ({ page }) => {
    await goToMenu(page)
    await expect(page.getByText('Lista de compras')).toBeVisible({ timeout: 15000 })
    await page.getByText('Lista de compras').click()
    await expect(page).toHaveURL(/\/menu\/shopping-list/)
  })

  test('shows Lista de Compras title', async ({ page }) => {
    await page.goto('/menu/shopping-list?weekStart=2025-01-06')
    await expect(page.getByText('Lista de Compras').first()).toBeVisible({ timeout: 15000 })
  })

  test('shows week label with weekStart date', async ({ page }) => {
    await page.goto('/menu/shopping-list?weekStart=2025-01-06')
    await expect(page.getByText(/Semana del lun.*6.*ene/)).toBeVisible({ timeout: 15000 })
  })

  test('shows back link to menu', async ({ page }) => {
    await page.goto('/menu/shopping-list?weekStart=2025-01-06')
    await expect(page.getByText('‹ Menú')).toBeVisible({ timeout: 15000 })
  })

  test('empty state shows no-ingredients message', async ({ page }) => {
    // A week far in the past is guaranteed to have no entries
    await page.goto('/menu/shopping-list?weekStart=2000-01-03')
    await expect(page.getByText('No hay ingredientes para esta semana')).toBeVisible({
      timeout: 15000,
    })
  })

  test('back link returns to menu planner', async ({ page }) => {
    await page.goto('/menu/shopping-list?weekStart=2025-01-06')
    await expect(page.getByText('‹ Menú')).toBeVisible({ timeout: 15000 })
    await page.getByText('‹ Menú').click()
    await expect(page).toHaveURL(/\/menu/)
  })
})

// 2026-10-02 review: the profile's "Porciones por defecto" was stored but never
// used — planning a dish always started at 2 portions.
test("planning a dish starts at the profile's default portions", async ({ page }) => {
  const headers = await authHeaders(page)
  const date = '2027-04-07'
  await page.request.patch(`${API_URL}/auth/profile`, { headers, data: { preferredServings: 5 } })
  const recipe = await createRecipeViaApi(page)
  try {
    await page.goto(`/menu/pick?date=${date}&slot=Cena&weekStart=2027-04-05`)
    await expect(page.getByTestId('pick-servings')).toHaveText('5')
    await page.getByTestId(`pick-recipe-${recipe.id}`).click()
    await expect
      .poll(async () => {
        const week = (await (
          await page.request.get(`${API_URL}/v1/menu?weekStart=2027-04-05`, { headers })
        ).json()) as { recipeId: string; servings: number }[]
        return week.find((e) => e.recipeId === recipe.id)?.servings
      })
      .toBe(5)
  } finally {
    await page.request.delete(`${API_URL}/v1/menu/${date}/Cena/${recipe.id}`, { headers })
    await deleteRecipeViaApi(page, recipe.id)
    await page.request.patch(`${API_URL}/auth/profile`, { headers, data: { preferredServings: 2 } })
  }
})
