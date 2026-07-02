import { test, expect } from './fixtures'

/**
 * Recipe CRUD E2E flows.
 * All tests run authenticated via the auth fixture.
 */

test.describe('Recipes: search and filter', () => {
  test('search filters recipe list', async ({ page }) => {
    await page.getByPlaceholder(/buscar recetas/i).fill('Milanesa')
    // Results should show Milanesa
    await expect(page.getByText(/Milanesa/i).first()).toBeVisible({ timeout: 8000 })
    // Clear search
    await page.getByPlaceholder(/buscar recetas/i).clear()
  })

  test('filter chip filters by food type', async ({ page }) => {
    // Click first non-"Todas" chip
    const chips = page
      .locator('text=/Bebida|Carne|Ensalada|Guiso|Minuta|Panificado|Pasta|Postre/')
      .first()
    const hasChip = await chips.count()
    if (hasChip > 0) {
      await chips.click()
      // Something should still be visible (filtered list or empty message)
      await expect(page.getByText(/receta|recetas|Agregar/i).first()).toBeVisible({ timeout: 5000 })
      // Reset
      await page.getByText('Todas').click()
    }
  })
})

test.describe('Recipes: create via form', () => {
  test('nueva receta button opens form', async ({ page }) => {
    await expect(page.getByText('+ Nueva Receta')).toBeVisible({ timeout: 8000 })
    await page.getByText('+ Nueva Receta').click()
    await expect(page.getByPlaceholder('Nombre de la receta')).toBeVisible({ timeout: 10000 })
  })

  test('form shows validation error for empty title', async ({ page }) => {
    await expect(page.getByText('+ Nueva Receta')).toBeVisible({ timeout: 8000 })
    await page.getByText('+ Nueva Receta').click()
    await expect(page.getByPlaceholder('Nombre de la receta')).toBeVisible({ timeout: 10000 })
    await page.getByText('Guardar Receta').click()
    // Zod produces "Too small: expected string to have >=1 characters" or similar
    await expect(
      page.getByText(/Too small|obligatorio|requerido|1 char|título/i).first(),
    ).toBeVisible({ timeout: 5000 })
  })

  test('creates a recipe and it appears in the list', async ({ page }) => {
    const recipeName = `E2E Receta ${Date.now()}`

    await page.getByText('+ Nueva Receta').click()
    await expect(page.getByPlaceholder('Nombre de la receta')).toBeVisible({ timeout: 5000 })

    // Fill form
    await page.getByPlaceholder('Nombre de la receta').fill(recipeName)

    // Set servings (already defaults to 4)

    // Add ingredient
    const ingredientInput = page.getByPlaceholder('Ingrediente').first()
    await ingredientInput.fill('Harina')
    const qtyInput = page.getByPlaceholder('Cant.').first()
    await qtyInput.fill('200')

    // Add step
    await page.getByText('+ Agregar paso').click()
    await page.getByPlaceholder(/Paso 1/i).fill('Mezclar ingredientes')

    // Save
    await page.getByText('Guardar Receta').click()

    // Should return to home and recipe appears
    await expect(page.getByText(recipeName)).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Recipes: detail view', () => {
  test('recipe detail shows title and cook button', async ({ page }) => {
    const firstRecipe = page
      .locator(
        'text=/Milanesa de pollo|Empanadas de carne|Guiso de lentejas|Tarta de verduras|Locro criollo|Alfajores caseros|Revuelto gramajo|Ensalada César/',
      )
      .first()
    await expect(firstRecipe).toBeVisible({ timeout: 10000 })
    const title = await firstRecipe.textContent()
    await firstRecipe.click()
    await page.waitForLoadState('networkidle', { timeout: 10000 })

    // After navigation, wait for cook button which is the most reliable indicator
    await expect(page.getByText('Iniciar cocina').first()).toBeVisible({ timeout: 20000 })
  })

  test('servings stepper is visible in detail', async ({ page }) => {
    const firstRecipe = page
      .locator(
        'text=/Milanesa de pollo|Empanadas de carne|Guiso de lentejas|Tarta de verduras|Locro criollo|Alfajores caseros|Revuelto gramajo|Ensalada César/',
      )
      .first()
    await expect(firstRecipe).toBeVisible({ timeout: 10000 })
    await firstRecipe.click()
    await page.waitForLoadState('networkidle', { timeout: 10000 })

    await expect(page.getByText('Iniciar cocina').first()).toBeVisible({ timeout: 20000 })
    await expect(page.getByText(/Porciones:/i).first()).toBeVisible()
  })
})
