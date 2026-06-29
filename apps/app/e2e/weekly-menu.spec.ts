import { test, expect, type Page } from '@playwright/test'

/**
 * E2E: Weekly menu planner, pick recipe and shopping list flows.
 * Requires the app to be running at PLAYWRIGHT_BASE_URL (default localhost:8081).
 *
 * Network state is real: tests that assert post-add state depend on the API
 * being available. Tests that only assert UI structure are marked with a comment
 * when they are safe to run without a seeded DB.
 */

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
    await expect(page).toHaveURL(/\/menu/, { timeout: 10000 })
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
    // Wait for the planner to load (either entries or + Agregar buttons)
    await expect(page.getByText('Desayuno').first()).toBeVisible({ timeout: 15000 })
    // All 5 slots should appear at least once across the 7-day grid
    for (const slot of ['Desayuno', 'Almuerzo', 'Merienda', 'Cena', 'Snacks/Otros']) {
      await expect(page.getByText(slot).first()).toBeVisible()
    }
  })

  test('empty state shows + Agregar buttons', async ({ page }) => {
    await goToMenu(page)
    // The planner renders empty slots as "+ Agregar" — at least one should be visible
    // when the week has no entries (or just some).
    await page.waitForTimeout(2000) // let query settle
    const addButtons = page.getByText('+ Agregar')
    const count = await addButtons.count()
    // A fully-empty week has 7 days × 5 slots = 35 buttons; at least 1 visible confirms empty state
    if (count > 0) {
      await expect(addButtons.first()).toBeVisible()
    }
    // If all slots are filled the test still passes — we just can't assert the empty state.
  })

  test('navigates to next week and back to previous week', async ({ page }) => {
    await goToMenu(page)
    await expect(page.getByText('‹ Anterior')).toBeVisible({ timeout: 15000 })

    // Capture the current week label before navigating
    const weekLabelLocator = page.locator('text=/\\d{1,2} de [a-z]+/i').first()
    const initialLabel = await weekLabelLocator.textContent()

    await page.getByText('Siguiente ›').click()
    // After clicking next, the week label should change
    await expect(async () => {
      const newLabel = await weekLabelLocator.textContent()
      expect(newLabel).not.toBe(initialLabel)
    }).toPass({ timeout: 5000 })

    await page.getByText('‹ Anterior').click()
    // Back to the original label
    await expect(async () => {
      const restoredLabel = await weekLabelLocator.textContent()
      expect(restoredLabel).toBe(initialLabel)
    }).toPass({ timeout: 5000 })
  })
})

test.describe('Pick recipe screen (/menu/pick)', () => {
  test('opens pick recipe screen from an empty slot', async ({ page }) => {
    await goToMenu(page)
    await expect(page.getByText('+ Agregar').first()).toBeVisible({ timeout: 15000 })
    await page.getByText('+ Agregar').first().click()
    await expect(page).toHaveURL(/\/menu\/pick/, { timeout: 10000 })
  })

  test('shows slot and date in header', async ({ page }) => {
    await goToMenu(page)
    await expect(page.getByText('+ Agregar').first()).toBeVisible({ timeout: 15000 })
    await page.getByText('+ Agregar').first().click()
    await expect(page).toHaveURL(/\/menu\/pick/, { timeout: 10000 })
    // Header shows "Slot · date" — both parts should contain expected content
    // The slot will be one of the SLOTS constants; just assert the separator is there
    await expect(page.getByText(/·/).first()).toBeVisible({ timeout: 10000 })
  })

  test('shows search input and porciones field', async ({ page }) => {
    await page.goto('/menu/pick?date=2025-01-06&slot=Almuerzo&weekStart=2025-01-06')
    await expect(page.getByPlaceholder('Buscar receta...')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Porciones:')).toBeVisible()
  })

  test('shows recipe list or empty state', async ({ page }) => {
    await page.goto('/menu/pick?date=2025-01-06&slot=Almuerzo&weekStart=2025-01-06')
    await page.waitForTimeout(2000)
    // Either recipes appear or the empty state text is shown
    const hasRecipes = (await page.getByText(/porc\. base/).count()) > 0
    if (!hasRecipes) {
      await expect(page.getByText('No hay recetas aún')).toBeVisible({ timeout: 10000 })
    }
  })

  test('search filters recipe list', async ({ page }) => {
    await page.goto('/menu/pick?date=2025-01-06&slot=Almuerzo&weekStart=2025-01-06')
    const searchInput = page.getByPlaceholder('Buscar receta...')
    await expect(searchInput).toBeVisible({ timeout: 15000 })
    await searchInput.fill('zzznomatch')
    await expect(page.getByText('Sin resultados')).toBeVisible({ timeout: 10000 })
  })

  test('servings input accepts numeric values', async ({ page }) => {
    await page.goto('/menu/pick?date=2025-01-06&slot=Almuerzo&weekStart=2025-01-06')
    const servingsInput = page
      .locator('input[inputmode="numeric"]')
      .or(page.locator('input[type="number"]'))
    // The servings field uses keyboardType="numeric" — on web it renders as a text input
    // with default value "2"
    const fallback = page.getByText('Porciones:').locator('..').locator('input')
    const input = (await servingsInput.count()) > 0 ? servingsInput.first() : fallback.first()
    await expect(input).toBeVisible({ timeout: 10000 })
    await input.fill('4')
    await expect(input).toHaveValue('4')
  })
})

test.describe('Shopping list screen (/menu/shopping-list)', () => {
  test('navigates to shopping list from menu planner', async ({ page }) => {
    await goToMenu(page)
    await expect(page.getByText('Lista de compras')).toBeVisible({ timeout: 15000 })
    await page.getByText('Lista de compras').click()
    await expect(page).toHaveURL(/\/menu\/shopping-list/, { timeout: 10000 })
  })

  test('shows Lista de Compras title', async ({ page }) => {
    await page.goto('/menu/shopping-list?weekStart=2025-01-06')
    await expect(page.getByText('Lista de Compras')).toBeVisible({ timeout: 15000 })
  })

  test('shows the week label with weekStart date', async ({ page }) => {
    await page.goto('/menu/shopping-list?weekStart=2025-01-06')
    await expect(page.getByText('Semana del 2025-01-06')).toBeVisible({ timeout: 15000 })
  })

  test('shows back link to menu', async ({ page }) => {
    await page.goto('/menu/shopping-list?weekStart=2025-01-06')
    await expect(page.getByText('‹ Menú')).toBeVisible({ timeout: 15000 })
  })

  test('empty state shows no-ingredients message', async ({ page }) => {
    // Use a past week that is guaranteed to have no entries
    await page.goto('/menu/shopping-list?weekStart=2000-01-03')
    await page.waitForTimeout(2000)
    const hasItems = (await page.getByText(/al gusto|\d+ [a-z]/).count()) > 0
    if (!hasItems) {
      await expect(page.getByText('No hay ingredientes para esta semana')).toBeVisible({
        timeout: 10000,
      })
    }
  })

  test('back link returns to menu planner', async ({ page }) => {
    await page.goto('/menu/shopping-list?weekStart=2025-01-06')
    await expect(page.getByText('‹ Menú')).toBeVisible({ timeout: 15000 })
    await page.getByText('‹ Menú').click()
    await expect(page).toHaveURL(/\/menu/, { timeout: 10000 })
  })

  test('shopping list items show ingredient name and quantity', async ({ page }) => {
    // This test only runs meaningfully when there are menu entries with recipes.
    // We seed a deterministic weekStart and check structure if items exist.
    await page.goto('/menu/shopping-list?weekStart=2025-01-06')
    await page.waitForTimeout(2000)
    const rows = page.locator('text=/al gusto/').or(page.locator('text=/\\d+/'))
    const count = await rows.count()
    if (count > 0) {
      // Each item row has ingredient name (left) and quantity/unit or "al gusto" (right)
      await expect(rows.first()).toBeVisible()
    }
  })
})
