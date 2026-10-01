import { test, expect } from './fixtures'
import { API_URL } from './env'

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

  test('food-type chip filters the list with and without a search term', async ({ page }) => {
    const token = await page.evaluate(() => localStorage.getItem('auth_token'))
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    const ftRes = await page.request.get(`${API_URL}/v1/food-types`, { headers })
    const [typeA, typeB] = (await ftRes.json()) as Array<{ id: string; name: string }>
    expect(typeA && typeB).toBeTruthy()

    const stamp = Date.now()
    const create = async (title: string, foodTypeId: string) => {
      const res = await page.request.post(`${API_URL}/v1/recipes`, {
        headers,
        data: {
          title,
          servings: 2,
          category: 'Cena',
          foodTypeIds: [foodTypeId],
          ingredients: [{ name: 'sal', quantity: 1, unit: 'g' }],
        },
      })
      expect(res.ok(), await res.text()).toBe(true)
      return ((await res.json()) as { id: string }).id
    }
    const titleA = `E2E Chip A ${stamp}`
    const titleB = `E2E Chip B ${stamp}`
    const ids = [await create(titleA, typeA!.id), await create(titleB, typeB!.id)]

    try {
      await page.reload()
      const search = page.getByPlaceholder(/buscar recetas/i)
      await search.fill(`E2E Chip`)
      await expect(page.getByText(titleA)).toBeVisible({ timeout: 8000 })
      await expect(page.getByText(titleB)).toBeVisible()

      // Chip + search term: only the matching type survives
      await page.getByTestId(`home-type-chip-${typeA!.id}`).click()
      await expect(page.getByText(titleB)).toHaveCount(0, { timeout: 8000 })
      await expect(page.getByText(titleA)).toBeVisible()

      // Chip alone (no search term) still filters
      await search.clear()
      await expect(page.getByText(titleA)).toBeVisible({ timeout: 8000 })
      await expect(page.getByText(titleB)).toHaveCount(0)

      // "Todas" clears the food-type filter
      await page.getByTestId('home-type-chip-all').click()
      await search.fill(`E2E Chip`)
      await expect(page.getByText(titleB)).toBeVisible({ timeout: 8000 })
    } finally {
      for (const id of ids) await page.request.delete(`${API_URL}/v1/recipes/${id}`, { headers })
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

    // Select a food type chip (FoodTypePicker)
    const foodTypeChip = page.locator('[data-testid^="food-type-chip-"]').first()
    if ((await foodTypeChip.count()) > 0) {
      await foodTypeChip.click()
    }

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

    // Lands on the new recipe with a saved notice, and it is in the list back home
    await expect(page.getByTestId('recipe-saved-banner')).toBeVisible({ timeout: 10000 })
    await page.goBack()
    await expect(page.getByText(recipeName)).toBeVisible({ timeout: 10000 })
  })

  // Regression test for the 2026-07-03 audit finding: foodTypeIds selected in
  // the picker used to never reach the backend at all (recipe_food_types was
  // never inserted into). Verify it's now genuinely persisted, not just that
  // the UI doesn't crash when a chip is tapped.
  test('selected food type is actually persisted on the created recipe', async ({ page }) => {
    const token = await page.evaluate(() => localStorage.getItem('auth_token'))
    const recipeName = `E2E Con Tipo ${Date.now()}`

    await page.getByText('+ Nueva Receta').click()
    await expect(page.getByPlaceholder('Nombre de la receta')).toBeVisible({ timeout: 5000 })
    await page.getByPlaceholder('Nombre de la receta').fill(recipeName)

    const foodTypeChip = page.locator('[data-testid^="food-type-chip-"]').first()
    await expect(foodTypeChip).toBeVisible({ timeout: 8000 })
    const testId = await foodTypeChip.getAttribute('data-testid')
    const expectedFoodTypeId = testId!.replace('food-type-chip-', '')
    await foodTypeChip.click()

    await page.getByPlaceholder('Ingrediente').first().fill('Harina')
    await page.getByPlaceholder('Cant.').first().fill('200')
    await page.getByText('+ Agregar paso').click()
    await page.getByPlaceholder(/Paso 1/i).fill('Mezclar ingredientes')
    await page.getByText('Guardar Receta').click()
    await expect(page.getByTestId('recipe-saved-banner')).toBeVisible({ timeout: 10000 })

    const listRes = await page.request.get(`${API_URL}/v1/recipes?limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const recipes = (await listRes.json()) as Array<{
      title: string
      foodTypeIds: string[]
    }>
    const created = recipes.find((r) => r.title === recipeName)
    expect(created?.foodTypeIds).toEqual([expectedFoodTypeId])
  })

  test('can select up to 3 food type chips', async ({ page }) => {
    await page.getByText('+ Nueva Receta').click()
    await expect(page.getByPlaceholder('Nombre de la receta')).toBeVisible({ timeout: 5000 })

    const chips = page.locator('[data-testid^="food-type-chip-"]')
    const count = await chips.count()
    if (count >= 2) {
      await chips.nth(0).click()
      await chips.nth(1).click()
      // No crash after selecting multiple
      await expect(page.getByPlaceholder('Nombre de la receta')).toBeVisible()
    }
  })
})

test.describe('Recipes: form on a phone and save feedback', () => {
  async function authHeaders(page: import('@playwright/test').Page) {
    const token = await page.evaluate(() => localStorage.getItem('auth_token'))
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  }

  test('at 390px every ingredient control is on screen and the full unit list opens', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByText('+ Nueva Receta').click()
    await expect(page.getByPlaceholder('Nombre de la receta')).toBeVisible({ timeout: 10000 })
    await page.getByText('+ Agregar ingrediente').click()

    for (const control of [
      page.getByPlaceholder('Ingrediente').first(),
      page.getByPlaceholder('Cant.').first(),
      page.getByTestId('ingredient-unit-0'),
      page.getByPlaceholder('Picado, etc.').first(),
      page.getByTestId('ingredient-remove-0'),
    ]) {
      await control.scrollIntoViewIfNeeded()
      const box = await control.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(390)
    }

    await page.getByTestId('ingredient-unit-0').click()
    for (const unit of ['tsp', 'tbsp', 'cup', 'unit', 'pinch', 'clove']) {
      await expect(page.getByTestId(`unit-option-0-${unit}`)).toBeVisible()
    }
    await page.getByTestId('unit-option-0-tbsp').click()
    await expect(page.getByTestId('ingredient-unit-0')).toContainText('cda')
  })

  test('opening /recipe/new directly and saving once lands on the new recipe', async ({ page }) => {
    const title = `E2E Guardado Directo ${Date.now()}`
    await page.goto('/recipe/new')
    await expect(page.getByPlaceholder('Nombre de la receta')).toBeVisible({ timeout: 10000 })
    await page.getByPlaceholder('Nombre de la receta').fill(title)
    await page.getByPlaceholder('Ingrediente').first().fill('Arroz')
    await page.getByText('Guardar Receta').click()

    await expect(page.getByTestId('recipe-saved-banner')).toBeVisible({ timeout: 10000 })
    await expect(page).toHaveURL(/\/recipe\/[0-9a-f-]{36}/)
    await expect(page.getByText(title)).toBeVisible()

    const headers = await authHeaders(page)
    const res = await page.request.get(
      `${API_URL}/v1/recipes/search?q=${encodeURIComponent(title)}`,
      { headers },
    )
    const found = (await res.json()) as Array<{ id: string }>
    expect(found).toHaveLength(1)
    await page.request.delete(`${API_URL}/v1/recipes/${found[0]!.id}`, { headers })
  })

  test('editing a recipe keeps a tbsp unit through the round trip', async ({ page }) => {
    const headers = await authHeaders(page)
    const created = await page.request.post(`${API_URL}/v1/recipes`, {
      headers,
      data: {
        title: `E2E Cucharada ${Date.now()}`,
        servings: 2,
        category: 'Cena',
        ingredients: [{ name: 'Aceite', quantity: 2, unit: 'tbsp' }],
      },
    })
    const { id } = (await created.json()) as { id: string }
    try {
      await page.goto(`/recipe/${id}/edit`)
      await expect(page.getByTestId('ingredient-unit-0')).toContainText('cda', { timeout: 10000 })
      await page.getByPlaceholder('Cant.').first().fill('3')
      await page.getByText('Guardar Cambios').click()
      await expect(page.getByTestId('recipe-saved-banner')).toBeVisible({ timeout: 10000 })

      const res = await page.request.get(`${API_URL}/v1/recipes/${id}`, { headers })
      const recipe = (await res.json()) as {
        ingredients: Array<{ unit: string; quantity: number }>
      }
      expect(recipe.ingredients[0]).toMatchObject({ unit: 'tbsp', quantity: 3 })
    } finally {
      await page.request.delete(`${API_URL}/v1/recipes/${id}`, { headers })
    }
  })
})

test.describe('Recipes: diet tags', () => {
  test('a tag the ingredients contradict is refused with the reason', async ({ page }) => {
    await page.getByText('+ Nueva Receta').click()
    await expect(page.getByPlaceholder('Nombre de la receta')).toBeVisible({ timeout: 10000 })
    await page.getByPlaceholder('Nombre de la receta').fill(`E2E Falso vegano ${Date.now()}`)
    await page.getByPlaceholder('Ingrediente').first().fill('Chorizo')
    await page.getByTestId('diet-chip-vegano').click()
    await page.getByText('Guardar Receta').click()
    await expect(page.getByText(/"vegano" no se cumple: contiene Chorizo/)).toBeVisible({
      timeout: 8000,
    })
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
    await expect(page.getByTestId('recipe-detail-cook')).toBeVisible({ timeout: 20000 })
    await expect(page.getByText(title!.trim(), { exact: true }).last()).toBeVisible()
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

    await expect(page.getByTestId('recipe-detail-cook')).toBeVisible({ timeout: 20000 })
    await expect(page.getByText(/Porciones:/i).first()).toBeVisible()
  })

  async function openFirstRecipeDetail(page: import('@playwright/test').Page) {
    const firstRecipe = page
      .locator(
        'text=/Milanesa de pollo|Empanadas de carne|Guiso de lentejas|Tarta de verduras|Locro criollo|Alfajores caseros|Revuelto gramajo|Ensalada César/',
      )
      .first()
    await expect(firstRecipe).toBeVisible({ timeout: 10000 })
    await firstRecipe.click()
    await page.waitForLoadState('networkidle', { timeout: 10000 })
    await expect(page.getByTestId('recipe-detail-cook')).toBeVisible({ timeout: 20000 })
  }

  test('unit toggle switches between cooking/metric/imperial', async ({ page }) => {
    await openFirstRecipeDetail(page)
    await expect(page.getByText('Métrico', { exact: true })).toBeVisible({ timeout: 5000 })
    await page.getByText('Métrico', { exact: true }).click()
    await expect(page.getByText('Imperial', { exact: true })).toBeVisible()
    await page.getByText('Imperial', { exact: true }).click()
    await page.getByText('Cocina', { exact: true }).click()
    // Screen stays functional after switching modes
    await expect(page.getByTestId('recipe-detail-cook')).toBeVisible()
  })

  test('editar link navigates to edit form', async ({ page }) => {
    await openFirstRecipeDetail(page)
    await page.getByText('Editar').click()
    await expect(page.getByText(/Editar Receta|Guardar Cambios/).first()).toBeVisible({
      timeout: 8000,
    })
  })

  // Note: this intentionally saves WITHOUT changing anything — it covers the
  // edit form's load-populate-save round trip. Actually mutating the title
  // would permanently rename seeded demo recipes that other tests locate by
  // name (openFirstRecipeDetail's title regex), breaking local reruns.
  test('saving the edit form without changes returns to detail', async ({ page }) => {
    await openFirstRecipeDetail(page)
    await page.getByText('Editar').click()
    await expect(page.getByText(/Editar Receta|Guardar Cambios/).first()).toBeVisible({
      timeout: 8000,
    })
    // Save without changes — should return to detail
    await page.getByText(/Guardar Cambios|Guardar Receta/).click()
    await expect(page.getByTestId('recipe-detail-cook')).toBeVisible({ timeout: 8000 })
  })

  test('can set times and difficulty in the edit form and save', async ({ page }) => {
    await openFirstRecipeDetail(page)
    await page.getByText('Editar').click()
    await expect(page.getByTestId('recipe-prep-time')).toBeVisible({ timeout: 8000 })

    await page.getByTestId('recipe-prep-time').fill('8')
    await page.getByTestId('recipe-cook-time').fill('12')
    await page.getByTestId('difficulty-chip-media').click()

    await page.getByText(/Guardar Cambios|Guardar Receta/).click()
    await expect(page.getByTestId('recipe-detail-cook')).toBeVisible({ timeout: 8000 })
  })

  test('can add and remove an ingredient row in the edit form', async ({ page }) => {
    await openFirstRecipeDetail(page)
    await page.getByText('Editar').click()
    await expect(page.getByText(/Editar Receta|Guardar Cambios/).first()).toBeVisible({
      timeout: 8000,
    })

    const nameInputs = page.getByPlaceholder('Ingrediente')
    const initialCount = await nameInputs.count()

    await page.getByText('+ Agregar ingrediente').click()
    await expect(nameInputs).toHaveCount(initialCount + 1)
    await nameInputs.last().fill('Perejil E2E')

    const newRow = nameInputs.last().locator('xpath=..')
    await newRow.getByText('✕').click()
    await expect(nameInputs).toHaveCount(initialCount)

    await page.getByText(/Guardar Cambios|Guardar Receta/).click()
    await expect(page.getByTestId('recipe-detail-cook')).toBeVisible({ timeout: 8000 })
  })

  test('can add and remove a step row in the edit form', async ({ page }) => {
    await openFirstRecipeDetail(page)
    await page.getByText('Editar').click()
    await expect(page.getByText(/Editar Receta|Guardar Cambios/).first()).toBeVisible({
      timeout: 8000,
    })

    const stepInputs = page.getByPlaceholder(/Paso \d+/)
    const initialCount = await stepInputs.count()

    await page.getByText('+ Agregar paso').click()
    await expect(stepInputs).toHaveCount(initialCount + 1)
    await stepInputs.last().fill('Servir bien caliente.')

    const newRow = stepInputs.last().locator('xpath=..')
    await newRow.getByText('✕').click()
    await expect(stepInputs).toHaveCount(initialCount)

    await page.getByText(/Guardar Cambios|Guardar Receta/).click()
    await expect(page.getByTestId('recipe-detail-cook')).toBeVisible({ timeout: 8000 })
  })

  test('history tab shows empty state or past sessions', async ({ page }) => {
    await openFirstRecipeDetail(page)
    await page.getByTestId('recipe-tab-history').click()
    await expect(page.getByText(/Todavía no cocinaste|★|☆/).first()).toBeVisible({ timeout: 8000 })
  })

  test('recipe tab returns from history to ingredients view', async ({ page }) => {
    await openFirstRecipeDetail(page)
    await page.getByTestId('recipe-tab-history').click()
    await page.getByTestId('recipe-tab-recipe').click()
    await expect(page.getByText('Ingredientes')).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Recipes: times & difficulty', () => {
  test('creates a recipe with times + difficulty and filters by them', async ({ page }) => {
    const recipeName = `E2E Rápida ${Date.now()}`

    await page.getByText('+ Nueva Receta').click()
    await expect(page.getByPlaceholder('Nombre de la receta')).toBeVisible({ timeout: 8000 })
    await page.getByPlaceholder('Nombre de la receta').fill(recipeName)
    await page.getByPlaceholder('Ingrediente').first().fill('Agua')
    await page.getByPlaceholder('Cant.').first().fill('1')
    await page.getByPlaceholder(/Paso 1/i).fill('Calentar.')

    // Times + difficulty (total = 15 min, fácil)
    await page.getByTestId('recipe-prep-time').fill('5')
    await page.getByTestId('recipe-cook-time').fill('10')
    await page.getByTestId('difficulty-chip-fácil').click()

    await page.getByText('Guardar Receta').click()
    await expect(page.getByTestId('recipe-saved-banner')).toBeVisible({ timeout: 10000 })
    await page.goBack()
    await expect(page.getByText(recipeName)).toBeVisible({ timeout: 10000 })

    // Compact "⏱ 15 min · fácil" line renders on the card.
    await expect(page.getByText('⏱ 15 min · fácil').first()).toBeVisible({ timeout: 8000 })

    // ≤20 min keeps our recipe but hides untimed seed recipes.
    await page.getByTestId('filter-time-20').click()
    await expect(page.getByText(recipeName)).toBeVisible()
    await expect(page.getByText('Milanesa de pollo')).toHaveCount(0)

    // difficulty=difícil hides our fácil recipe.
    await page.getByTestId('filter-time-20').click()
    await page.getByTestId('filter-difficulty-difícil').click()
    await expect(page.getByText(recipeName)).toHaveCount(0)
  })
})
