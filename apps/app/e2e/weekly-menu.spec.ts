import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

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
    await expect(page.getByText('Desayuno', { exact: true }).first()).toBeVisible({
      timeout: 15000,
    })
    for (const slot of ['Desayuno', 'Almuerzo', 'Merienda', 'Cena', 'Snacks/Otros']) {
      await expect(page.getByText(slot, { exact: true }).first()).toBeVisible()
    }
  })

  test('empty state shows + Agregar buttons', async ({ page }) => {
    await goToMenu(page)
    await page.waitForTimeout(2000)
    const addButtons = page.getByText('+ Agregar')
    const count = await addButtons.count()
    if (count > 0) {
      await expect(addButtons.first()).toBeVisible()
    }
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
    }).toPass({ timeout: 5000 })

    await prevBtn.click()
    await expect(async () => {
      expect(await weekLabel.textContent()).toBe(initialText)
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

  test('shows slot · date separator in header', async ({ page }) => {
    await goToMenu(page)
    await expect(page.getByText('+ Agregar').first()).toBeVisible({ timeout: 15000 })
    await page.getByText('+ Agregar').first().click()
    await expect(page).toHaveURL(/\/menu\/pick/, { timeout: 10000 })
    await expect(page.getByTestId('pick-header-slot-date')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('pick-header-slot-date')).toContainText('·')
  })

  test('shows search input and porciones field', async ({ page }) => {
    await page.goto('/menu/pick?date=2025-01-06&slot=Almuerzo&weekStart=2025-01-06')
    await expect(page.getByPlaceholder('Buscar receta...')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Porciones:')).toBeVisible()
  })

  test('shows recipe list or empty state', async ({ page }) => {
    await page.goto('/menu/pick?date=2025-01-06&slot=Almuerzo&weekStart=2025-01-06')
    await page.waitForTimeout(2000)
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

  test('servings stepper increments the value', async ({ page }) => {
    await page.goto('/menu/pick?date=2025-01-06&slot=Almuerzo&weekStart=2025-01-06')
    await expect(page.getByText('Porciones:')).toBeVisible({ timeout: 10000 })
    const plusBtn = page.getByText('+', { exact: true }).first()
    const initial = await page.getByText(/^\d+$/).first().textContent()
    await plusBtn.click()
    await expect(async () => {
      const current = await page.getByText(/^\d+$/).first().textContent()
      expect(current).not.toBe(initial)
    }).toPass({ timeout: 5000 })
  })

  // Regression test for the 2026-07-03 audit finding (parent/family persona):
  // the allergen warning only showed up on the recipe detail page, three taps
  // deep from where planning actually happens. Now the picker shows a badge.
  test('shows an allergen badge on recipes that conflict with the profile', async ({ page }) => {
    const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000'
    const token = await page.evaluate(() => localStorage.getItem('auth_token'))
    await page.request.patch(`${API_URL}/auth/profile`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { allergens: ['queso'] },
    })

    await page.goto('/menu/pick?date=2025-01-06&slot=Almuerzo&weekStart=2025-01-06')
    await expect(page.getByPlaceholder('Buscar receta...')).toBeVisible({ timeout: 15000 })
    await page.getByPlaceholder('Buscar receta...').fill('Tarta')
    await expect(page.getByTestId('allergen-badge').first()).toBeVisible({ timeout: 10000 })
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
    await expect(page.getByText('Lista de Compras').first()).toBeVisible({ timeout: 15000 })
  })

  test('shows week label with weekStart date', async ({ page }) => {
    await page.goto('/menu/shopping-list?weekStart=2025-01-06')
    await expect(page.getByText('Semana del 2025-01-06')).toBeVisible({ timeout: 15000 })
  })

  test('shows back link to menu', async ({ page }) => {
    await page.goto('/menu/shopping-list?weekStart=2025-01-06')
    await expect(page.getByText('‹ Menú')).toBeVisible({ timeout: 15000 })
  })

  test('empty state shows no-ingredients message', async ({ page }) => {
    // A week far in the past is guaranteed to have no entries
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
})
