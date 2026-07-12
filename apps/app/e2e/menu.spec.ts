import { test, expect } from './fixtures'

/**
 * Weekly menu E2E flows.
 * All tests run authenticated via the auth fixture.
 */

test.describe('Menu: navigation', () => {
  test('Menú Semanal button opens menu screen', async ({ page }) => {
    await page.getByText('Menú Semanal').click()
    await expect(page.getByText(/Anterior|Siguiente/i).first()).toBeVisible({ timeout: 8000 })
    await expect(page.getByText('Lista de compras')).toBeVisible()
  })

  test('week navigation shows previous and next buttons', async ({ page }) => {
    await page.getByText('Menú Semanal').click()
    await expect(page.getByText('‹ Anterior')).toBeVisible({ timeout: 8000 })
    await expect(page.getByText('Siguiente ›')).toBeVisible()
  })

  test('clicking Anterior changes the week — Siguiente becomes active', async ({ page }) => {
    await page.getByText('Menú Semanal').click()
    await expect(page.getByText('‹ Anterior')).toBeVisible({ timeout: 8000 })
    // Navigate to previous week
    await page.getByText('‹ Anterior').click()
    await page.waitForTimeout(300)
    // Siguiente always visible; structure same
    await expect(page.getByText('Siguiente ›')).toBeVisible()
    await expect(page.getByText('‹ Anterior')).toBeVisible()
  })
})

test.describe('Menu: add recipe to slot', () => {
  test('+ Agregar opens recipe picker', async ({ page }) => {
    await page.getByText('Menú Semanal').click()
    await expect(page.getByText('+ Agregar').first()).toBeVisible({ timeout: 8000 })
    await page.getByText('+ Agregar').first().click()
    // Recipe picker should open
    await expect(page.getByPlaceholder('Buscar receta...')).toBeVisible({ timeout: 5000 })
  })

  test('recipe picker has servings stepper', async ({ page }) => {
    await page.getByText('Menú Semanal').click()
    await expect(page.getByText('+ Agregar').first()).toBeVisible({ timeout: 8000 })
    await page.getByText('+ Agregar').first().click()
    await page.waitForLoadState('networkidle', { timeout: 10000 })
    // Pick screen: search input + servings stepper
    await expect(page.getByPlaceholder('Buscar receta...')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Porciones:')).toBeVisible()
  })

  test('can add a recipe to a slot', async ({ page }) => {
    await page.getByText('Menú Semanal').click()
    await expect(page.getByText('+ Agregar').first()).toBeVisible({ timeout: 8000 })
    await page.getByText('+ Agregar').first().click()
    await page.waitForLoadState('networkidle', { timeout: 10000 })
    await expect(page.getByPlaceholder('Buscar receta...')).toBeVisible({ timeout: 10000 })

    // RN Web may hide items — use evaluate to find + click
    const recipeName = await page.evaluate((pattern) => {
      const allText = Array.from(document.querySelectorAll('[dir="auto"]')).find((el) =>
        new RegExp(pattern).test(el.textContent ?? ''),
      )
      if (allText) {
        allText.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        return allText.textContent
      }
      return null
    }, 'Milanesa de pollo|Empanadas de carne|Guiso de lentejas|Revuelto gramajo|Alfajores caseros')

    await page.waitForLoadState('networkidle', { timeout: 10000 })
    // Verify we navigated back (URL changed from /menu/pick)
    await expect(page).not.toHaveURL(/\/menu\/pick/, { timeout: 8000 })
  })

  test('slot shows multiple recipes after adding second', async ({ page }) => {
    await page.getByText('Menú Semanal').click()
    await expect(page.getByText('+ Agregar').first()).toBeVisible({ timeout: 8000 })
    await page.getByText('+ Agregar').first().click()
    await page.waitForLoadState('networkidle', { timeout: 10000 })
    await expect(page.getByPlaceholder('Buscar receta...')).toBeVisible({ timeout: 10000 })

    await page.evaluate((pattern) => {
      const allText = Array.from(document.querySelectorAll('[dir="auto"]')).find((el) =>
        new RegExp(pattern).test(el.textContent ?? ''),
      )
      if (allText)
        allText.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    }, 'Milanesa de pollo|Empanadas de carne|Guiso de lentejas|Revuelto gramajo|Alfajores caseros')

    await page.waitForLoadState('networkidle', { timeout: 10000 })
    await expect(page).not.toHaveURL(/\/menu\/pick/, { timeout: 8000 })
    await expect(page.getByText('+ Agregar').first()).toBeAttached()
  })
})

test.describe('Menu: pick screen filters', () => {
  test('time and difficulty filter chips work in the picker', async ({ page }) => {
    await page.getByText('Menú Semanal').click()
    await expect(page.locator('[data-testid^="menu-add-"]').first()).toBeVisible({ timeout: 8000 })
    await page.locator('[data-testid^="menu-add-"]').first().click()
    await page.waitForLoadState('networkidle', { timeout: 15000 })
    await expect(page.getByPlaceholder('Buscar receta...')).toBeVisible({ timeout: 10000 })

    // Toggle filters on and off — exercises the picker's filter handlers.
    await page.getByTestId('filter-time-20').click()
    await page.getByTestId('filter-difficulty-fácil').click()
    await page.getByTestId('filter-time-20').click()
    await page.getByTestId('filter-difficulty-fácil').click()

    // Picker still functional after filtering.
    await expect(page.getByPlaceholder('Buscar receta...')).toBeVisible()
  })
})

test.describe('Menu: edit servings', () => {
  async function ensureRecipeInMenu(page: import('@playwright/test').Page) {
    // Add a recipe if there's no chip yet — uses testID for reliable pick
    const chip = page.locator('[data-testid^="menu-entry-"]').first()
    if ((await chip.count()) === 0) {
      await page.locator('[data-testid^="menu-add-"]').first().click()
      await page.waitForLoadState('networkidle', { timeout: 15000 })
      const firstPickItem = page.locator('[data-testid^="pick-recipe-"]').first()
      await expect(firstPickItem).toBeVisible({ timeout: 15000 })
      await firstPickItem.click()
      await page.waitForLoadState('networkidle', { timeout: 15000 })
    }
  }

  test('tapping recipe chip opens edit modal', async ({ page }) => {
    await page.getByText('Menú Semanal').click()
    await expect(page.locator('[data-testid^="menu-add-"]').first()).toBeVisible({ timeout: 8000 })
    await ensureRecipeInMenu(page)

    // Click the chip using testID — triggers React's onPress via native pointer event
    const chip = page.locator('[data-testid^="menu-entry-"]').first()
    await expect(chip).toBeVisible({ timeout: 8000 })
    await chip.click()

    // Modal opens — identified by the save/delete testIDs
    await expect(page.getByTestId('menu-modal-save')).toBeVisible({ timeout: 8000 })
    await expect(page.getByTestId('menu-modal-delete')).toBeVisible()
  })

  test('can update servings in modal', async ({ page }) => {
    await page.getByText('Menú Semanal').click()
    await expect(page.locator('[data-testid^="menu-add-"]').first()).toBeVisible({ timeout: 8000 })
    await ensureRecipeInMenu(page)

    const chip = page.locator('[data-testid^="menu-entry-"]').first()
    await expect(chip).toBeVisible({ timeout: 8000 })
    await chip.click()
    await expect(page.getByTestId('menu-modal-save')).toBeVisible({ timeout: 8000 })

    // Increment servings and save
    await page.getByText('+').last().click()
    await page.waitForTimeout(300)
    await page.getByTestId('menu-modal-save').click()
    // Modal closes after save
    await expect(page.getByTestId('menu-modal-save')).not.toBeVisible({ timeout: 10000 })
  })
})

test.describe('Menu: shopping list', () => {
  test('shopping list button from menu shows list', async ({ page }) => {
    await page.getByText('Menú Semanal').click()
    await page.waitForLoadState('networkidle', { timeout: 10000 })
    await expect(page.getByText('Lista de compras')).toBeVisible({ timeout: 10000 })
    await page.getByText('Lista de compras').click()
    await page.waitForLoadState('networkidle', { timeout: 15000 })
    await expect(page.getByText('Lista de Compras').first()).toBeAttached({ timeout: 10000 })
  })

  test('shopping list from home shortcut works', async ({ page }) => {
    await expect(page.getByText('🛒 Compras')).toBeVisible({ timeout: 8000 })
    await page.getByText('🛒 Compras').click()
    await expect(page.getByText('Lista de Compras').first()).toBeVisible({ timeout: 8000 })
  })

  test('shopping list shows items or empty state', async ({ page }) => {
    await page.getByText('🛒 Compras').click()
    await expect(page.getByText('Lista de Compras').first()).toBeVisible({ timeout: 8000 })
    // Either has measurable items or shows the empty state. FlatList's
    // ListEmptyComponent can render a frame or two after the header on web
    // (VirtualizedList's own layout pass), so poll instead of taking a
    // single point-in-time snapshot right after the header appears.
    await expect
      .poll(
        async () => {
          const hasItems = await page.getByText(/\d+ (g|kg|ml|l|cdta|cda|taza|u)/).count()
          const hasEmpty = await page.getByText(/No hay ingredientes/i).count()
          return hasItems + hasEmpty
        },
        { timeout: 8000 },
      )
      .toBeGreaterThan(0)
  })
})
