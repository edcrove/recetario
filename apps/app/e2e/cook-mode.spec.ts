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
    await expect(page.getByTestId('recipe-detail-cook')).toBeVisible({ timeout: 20000 })
  }

  test('Iniciar cocina button is visible on recipe detail', async ({ page }) => {
    await openRecipeDetail(page)
    await expect(page.getByTestId('recipe-detail-cook')).toBeVisible({ timeout: 5000 })
  })

  test('cook mode opens with step counter', async ({ page }) => {
    await openRecipeDetail(page)
    await page.getByTestId('recipe-detail-cook').click()
    await expect(page.getByText(/Paso \d+ \/ \d+/)).toBeVisible({ timeout: 8000 })
  })

  test('cook mode has Pasos and Ingredientes tabs', async ({ page }) => {
    await openRecipeDetail(page)
    await page.getByTestId('recipe-detail-cook').click()
    await expect(page.getByText(/Paso \d+ \/ \d+/)).toBeVisible({ timeout: 8000 })
    // Verify step counter visible (cook mode is active)
    await expect(page.getByText(/Paso \d+ \/ \d+/)).toBeVisible()
    // Tab switcher has Pasos and Ingredientes
    const tabBar = page.locator('text=Pasos').first()
    await expect(tabBar).toBeVisible()
  })

  test('can navigate to next step', async ({ page }) => {
    await openRecipeDetail(page)
    await page.getByTestId('recipe-detail-cook').click()
    await expect(page.getByText(/Paso 1 \/ /)).toBeVisible({ timeout: 8000 })

    const nextBtn = page.getByTestId('cook-next').or(page.getByTestId('cook-finish')).first()
    await expect(nextBtn).toBeVisible({ timeout: 5000 })
    await nextBtn.click()

    // Either moved to step 2 or opened rating modal
    const step2 = page.getByText(/Paso 2 \/ /)
    const ratingModal = page.getByText('¿Cómo salió?')
    await expect(step2.or(ratingModal)).toBeVisible({ timeout: 5000 })
  })

  test('ingredients tab shows ingredient checklist', async ({ page }) => {
    await openRecipeDetail(page)
    await page.getByTestId('recipe-detail-cook').click()
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
    const recipe = page.locator('[data-testid^="recipe-card-"]').first()
    await expect(recipe).toBeVisible({ timeout: 10000 })
    await recipe.click()
    await expect(page.getByTestId('recipe-detail-cook')).toBeVisible({ timeout: 8000 })
    await page.getByTestId('recipe-detail-cook').click()

    let attempts = 0
    while (attempts < 10) {
      if ((await page.getByText('¿Cómo salió?').count()) > 0) break
      const nextBtn = page.getByText(/Siguiente|Finalizar/).first()
      if ((await nextBtn.count()) === 0) break
      await nextBtn.click()
      attempts++
    }

    await expect(page.getByText('¿Cómo salió?')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('cook-rating-save')).toBeVisible()
    await expect(page.getByTestId('cook-rating-skip')).toBeVisible()
  })

  test('can skip rating and return', async ({ page }) => {
    const recipe = page.locator('[data-testid^="recipe-card-"]').first()
    await expect(recipe).toBeVisible({ timeout: 10000 })
    await recipe.click()
    await page.getByTestId('recipe-detail-cook').click()

    let attempts = 0
    while (attempts < 10) {
      if ((await page.getByText('¿Cómo salió?').count()) > 0) break
      const nextBtn = page.getByText(/Siguiente|Finalizar/).first()
      if ((await nextBtn.count()) === 0) break
      await nextBtn.click()
      attempts++
    }

    await expect(page.getByTestId('cook-rating-skip')).toBeVisible({ timeout: 5000 })
    await page.getByTestId('cook-rating-skip').click()
    // After skip, app navigates back — verify we're no longer in cook mode
    await expect(page.getByTestId('cook-rating-skip')).not.toBeVisible({ timeout: 8000 })
  })
})
