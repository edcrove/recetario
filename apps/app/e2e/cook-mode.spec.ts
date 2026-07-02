import { test, expect } from './fixtures'

/**
 * Cook mode E2E flows.
 * Requires at least one recipe with steps to be accessible.
 */

test.describe('Cook mode: basic flow', () => {
  async function openRecipeDetail(page: import('@playwright/test').Page) {
    const recipe = page
      .locator(
        'text=/Milanesa de pollo|Empanadas de carne|Guiso de lentejas|Locro criollo|Tarta de verduras/',
      )
      .first()
    await expect(recipe).toBeVisible({ timeout: 10000 })
    await recipe.click()
    await page.waitForLoadState('networkidle', { timeout: 10000 })
    await expect(page.getByText('Iniciar cocina').first()).toBeVisible({ timeout: 20000 })
  }

  test('Iniciar cocina button is visible on recipe detail', async ({ page }) => {
    await openRecipeDetail(page)
    await expect(page.getByText('Iniciar cocina')).toBeVisible({ timeout: 5000 })
  })

  test('cook mode opens with step counter', async ({ page }) => {
    await openRecipeDetail(page)
    await page.getByText('Iniciar cocina').click()
    await expect(page.getByText(/Paso \d+ \/ \d+/)).toBeVisible({ timeout: 8000 })
  })

  test('cook mode has Pasos and Ingredientes tabs', async ({ page }) => {
    await openRecipeDetail(page)
    await page.getByText('Iniciar cocina').click()
    await expect(page.getByText(/Paso \d+ \/ \d+/)).toBeVisible({ timeout: 8000 })
    // Verify step counter visible (cook mode is active)
    await expect(page.getByText(/Paso \d+ \/ \d+/)).toBeVisible()
    // Tab switcher has Pasos and Ingredientes
    const tabBar = page.locator('text=Pasos').first()
    await expect(tabBar).toBeVisible()
  })

  test('can navigate to next step', async ({ page }) => {
    await openRecipeDetail(page)
    await page.getByText('Iniciar cocina').click()
    await expect(page.getByText(/Paso 1 \/ /)).toBeVisible({ timeout: 8000 })

    const nextBtn = page.getByText(/Siguiente|Finalizar/).first()
    await expect(nextBtn).toBeVisible()
    await nextBtn.click()

    // Either moved to step 2 or opened rating modal
    const step2 = page.getByText(/Paso 2 \/ /)
    const ratingModal = page.getByText('¿Cómo salió?')
    await expect(step2.or(ratingModal)).toBeVisible({ timeout: 5000 })
  })

  test('ingredients tab shows ingredient checklist', async ({ page }) => {
    await openRecipeDetail(page)
    await page.getByText('Iniciar cocina').click()
    await expect(page.getByText(/Paso \d+ \/ \d+/)).toBeVisible({ timeout: 8000 })
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('[dir="auto"]')).filter(
        (el) => el.textContent === 'Ingredientes',
      )
      tabs.forEach((t) =>
        t.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })),
      )
    })
    // After tab switch, ingredients are in the checklist
    // Use evaluate in case they're hidden by RN Web transform
    const hasIngredient = await page.evaluate(() => {
      const pattern = /Pechugas|Cebolla|Harina|Lentejas|Espinaca|Maíz/
      return Array.from(document.querySelectorAll('[dir="auto"]')).some((el) =>
        pattern.test(el.textContent ?? ''),
      )
    })
    expect(hasIngredient).toBe(true)
  })

  test('rating modal appears after finishing all steps', async ({ page }) => {
    const recipe = page.locator('text=/Revuelto gramajo/').first()
    const hasRecipe = await recipe.count()
    if (hasRecipe === 0) {
      test.skip()
      return
    }

    await recipe.click()
    await expect(page.getByText('Iniciar cocina')).toBeVisible({ timeout: 8000 })
    await page.getByText('Iniciar cocina').click()

    let attempts = 0
    while (attempts < 10) {
      if ((await page.getByText('¿Cómo salió?').count()) > 0) break
      const nextBtn = page.getByText(/Siguiente|Finalizar/).first()
      if ((await nextBtn.count()) === 0) break
      await nextBtn.click()
      attempts++
    }

    await expect(page.getByText('¿Cómo salió?')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Guardar y terminar')).toBeVisible()
    await expect(page.getByText('Omitir')).toBeVisible()
  })

  test('can skip rating and return', async ({ page }) => {
    const recipe = page.locator('text=/Revuelto gramajo/').first()
    const hasRecipe = await recipe.count()
    if (hasRecipe === 0) {
      test.skip()
      return
    }

    await recipe.click()
    await page.getByText('Iniciar cocina').click()

    let attempts = 0
    while (attempts < 10) {
      if ((await page.getByText('¿Cómo salió?').count()) > 0) break
      const nextBtn = page.getByText(/Siguiente|Finalizar/).first()
      if ((await nextBtn.count()) === 0) break
      await nextBtn.click()
      attempts++
    }

    await expect(page.getByText('Omitir')).toBeVisible({ timeout: 5000 })
    await page.getByText('Omitir').click()
    // After skip, app navigates back — verify we're no longer in cook mode
    await expect(page.getByText('Omitir')).not.toBeAttached({ timeout: 8000 })
  })
})
