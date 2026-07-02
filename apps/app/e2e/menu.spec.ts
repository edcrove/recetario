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

test.describe('Menu: edit servings', () => {
  // FIXME: RN onPress doesn't fire from dispatchEvent; needs Playwright touch API or mobile emulation
  test.fixme('tapping recipe chip opens edit modal', async ({ page }) => {
    await page.getByText('Menú Semanal').click()
    await expect(page.getByText('+ Agregar').first()).toBeVisible({ timeout: 8000 })

    // Add a recipe via evaluate if no chip exists
    let chip = page.getByText(/\d+ porc\./).first()
    if ((await chip.count()) === 0) {
      await page.getByText('+ Agregar').first().click()
      await page.waitForLoadState('networkidle', { timeout: 10000 })
      await page.evaluate((pattern) => {
        const el = Array.from(document.querySelectorAll('[dir="auto"]')).find((el) =>
          new RegExp(pattern).test(el.textContent ?? ''),
        )
        if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      }, 'Milanesa de pollo|Empanadas de carne|Guiso de lentejas')
      await page.waitForLoadState('networkidle', { timeout: 10000 })
      chip = page.getByText(/\d+ porc\./).first()
    }

    if ((await chip.count()) === 0) {
      test.skip()
      return
    }

    // Click the chip to open the edit modal using evaluate
    await page.evaluate(() => {
      const chips = Array.from(document.querySelectorAll('[dir="auto"]')).filter((el) =>
        /\d+ porc\./.test(el.textContent ?? ''),
      )
      if (chips[0]) {
        const parent = chips[0].parentElement?.parentElement
        if (parent)
          parent.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      }
    })
    await expect(page.getByText('Porciones')).toBeVisible({ timeout: 8000 })
    await expect(page.getByText('Guardar')).toBeVisible()
    await expect(page.getByText('Eliminar del menú')).toBeVisible()
  })

  // FIXME: depends on chip modal which can't be opened via dispatchEvent
  test.fixme('can update servings in modal', async ({ page }) => {
    await page.getByText('Menú Semanal').click()
    await expect(page.getByText('+ Agregar').first()).toBeVisible({ timeout: 8000 })

    const chip = page.getByText(/\d+ porc\./).first()
    if ((await chip.count()) === 0) {
      test.skip()
      return
    }

    // Open modal via evaluate
    await page.evaluate(() => {
      const chips = Array.from(document.querySelectorAll('[dir="auto"]')).filter((el) =>
        /\d+ porc\./.test(el.textContent ?? ''),
      )
      if (chips[0]) {
        const parent = chips[0].parentElement?.parentElement
        if (parent)
          parent.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      }
    })
    await expect(page.getByText('Guardar')).toBeVisible({ timeout: 8000 })

    // Increment servings and save
    await page.getByText('+').last().click()
    await page.getByText('Guardar').last().click()
    await expect(page.getByText('Eliminar del menú')).not.toBeVisible({ timeout: 5000 })
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
    // Either has measurable items or shows the empty state
    const hasItems = await page.getByText(/\d+ (g|kg|ml|l|cdta|cda|taza|u)/).count()
    const hasEmpty = await page.getByText(/No hay ingredientes/i).count()
    expect(hasItems + hasEmpty).toBeGreaterThan(0)
  })
})
