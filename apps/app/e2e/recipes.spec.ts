import { test, expect } from './fixtures'
import { API_URL } from './env'
import { openSeededRecipe, SEEDED_RECIPE } from './recipeNav'
import { authHeaders, createRecipeViaApi, deleteRecipeViaApi } from './api'

/**
 * Recipe CRUD E2E flows.
 * All tests run authenticated via the auth fixture.
 */

test.describe('Recipes: search and filter', () => {
  // Story #121 regression (search input lost focus on every keystroke) had no test.
  test('typing in search keeps the focus between keystrokes', async ({ page }) => {
    const search = page.getByPlaceholder(/buscar recetas/i)
    await search.click()
    await search.pressSequentially('Gui', { delay: 60 })
    await expect(page.locator('[data-testid^="recipe-card-"]').first()).toBeVisible()
    await search.pressSequentially('so', { delay: 60 })
    await expect(search).toBeFocused()
    await expect(search).toHaveValue('Guiso')
  })

  test('search filters recipe list', async ({ page }) => {
    await page.getByPlaceholder(/buscar recetas/i).fill('Milanesa')
    // Results should show Milanesa
    await expect(page.getByText(/Milanesa/i).first()).toBeVisible()
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
      await expect(page.getByText(titleA)).toBeVisible()
      await expect(page.getByText(titleB)).toBeVisible()

      // Chip + search term: only the matching type survives
      await page.getByTestId(`home-type-chip-${typeA!.id}`).click()
      await expect(page.getByText(titleB)).toHaveCount(0)
      await expect(page.getByText(titleA)).toBeVisible()

      // Chip alone (no search term) still filters
      await search.clear()
      await expect(page.getByText(titleA)).toBeVisible()
      await expect(page.getByText(titleB)).toHaveCount(0)

      // "Todas" clears the food-type filter
      await page.getByTestId('home-type-chip-all').click()
      await search.fill(`E2E Chip`)
      await expect(page.getByText(titleB)).toBeVisible()
    } finally {
      for (const id of ids) await page.request.delete(`${API_URL}/v1/recipes/${id}`, { headers })
    }
  })
})

test.describe('Recipes: create via form', () => {
  test('nueva receta button opens form', async ({ page }) => {
    await expect(page.getByText('+ Nueva Receta')).toBeVisible()
    await page.getByText('+ Nueva Receta').click()
    await expect(page.getByPlaceholder('Nombre de la receta')).toBeVisible()
  })

  test('form shows validation error for empty title', async ({ page }) => {
    await expect(page.getByText('+ Nueva Receta')).toBeVisible()
    await page.getByText('+ Nueva Receta').click()
    await expect(page.getByPlaceholder('Nombre de la receta')).toBeVisible()
    await page.getByText('Guardar Receta').click()
    // Auditar 2026-10-03: this used to show Zod's English "Too small: …"
    await expect(page.getByText('Poné un título.')).toBeVisible()
    await expect(page.getByText('Agregá al menos un ingrediente.')).toBeVisible()
    await expect(page.getByTestId('recipe-form-error-summary')).toHaveText(
      'Revisá: título, ingredientes.',
    )
    await expect(page.getByText(/Too small|expected/i)).toHaveCount(0)
  })

  test('creates a recipe and it appears in the list', async ({ page }) => {
    const recipeName = `E2E Receta ${Date.now()}`

    await page.getByText('+ Nueva Receta').click()
    await expect(page.getByPlaceholder('Nombre de la receta')).toBeVisible()

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
    await expect(page.getByTestId('recipe-saved-banner')).toBeVisible()
    await page.goBack()
    await expect(page.getByText(recipeName)).toBeVisible()
  })

  // Regression test for the 2026-07-03 audit finding: foodTypeIds selected in
  // the picker used to never reach the backend at all (recipe_food_types was
  // never inserted into). Verify it's now genuinely persisted, not just that
  // the UI doesn't crash when a chip is tapped.
  test('selected food type is actually persisted on the created recipe', async ({ page }) => {
    const token = await page.evaluate(() => localStorage.getItem('auth_token'))
    const recipeName = `E2E Con Tipo ${Date.now()}`

    await page.getByText('+ Nueva Receta').click()
    await expect(page.getByPlaceholder('Nombre de la receta')).toBeVisible()
    await page.getByPlaceholder('Nombre de la receta').fill(recipeName)

    const foodTypeChip = page.locator('[data-testid^="food-type-chip-"]').first()
    await expect(foodTypeChip).toBeVisible()
    const testId = await foodTypeChip.getAttribute('data-testid')
    const expectedFoodTypeId = testId!.replace('food-type-chip-', '')
    await foodTypeChip.click()

    await page.getByPlaceholder('Ingrediente').first().fill('Harina')
    await page.getByPlaceholder('Cant.').first().fill('200')
    await page.getByText('+ Agregar paso').click()
    await page.getByPlaceholder(/Paso 1/i).fill('Mezclar ingredientes')
    await page.getByText('Guardar Receta').click()
    await expect(page.getByTestId('recipe-saved-banner')).toBeVisible()

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
    await expect(page.getByPlaceholder('Nombre de la receta')).toBeVisible()

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
    await expect(page.getByPlaceholder('Nombre de la receta')).toBeVisible()
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
    await expect(page.getByPlaceholder('Nombre de la receta')).toBeVisible()
    await page.getByPlaceholder('Nombre de la receta').fill(title)
    await page.getByPlaceholder('Ingrediente').first().fill('Arroz')
    await page.getByText('Guardar Receta').click()

    await expect(page.getByTestId('recipe-saved-banner')).toBeVisible()
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
      await expect(page.getByTestId('ingredient-unit-0')).toContainText('cda')
      await page.getByPlaceholder('Cant.').first().fill('3')
      await page.getByText('Guardar Cambios').click()
      await expect(page.getByTestId('recipe-saved-banner')).toBeVisible()

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

test.describe('Recipes: edit keeps a total-only time', () => {
  // Auditar 2026-10-03: seed and MCP recipes only store totalTimeMin; saving
  // the edit form without touching the times erased it.
  test('saving the edit form untouched keeps the stored total time', async ({ page }) => {
    const headers = await authHeaders(page)
    const { id } = await createRecipeViaApi(page, { totalTimeMin: 45 })
    try {
      await page.goto(`/recipe/${id}/edit`)
      await expect(page.getByTestId('recipe-total-time-hint')).toContainText('45 min')
      await page.getByText('Guardar Cambios').click()
      await expect(page.getByTestId('recipe-saved-banner')).toBeVisible()
      const recipe = (await (
        await page.request.get(`${API_URL}/v1/recipes/${id}`, { headers })
      ).json()) as { totalTimeMin: number | null }
      expect(recipe.totalTimeMin).toBe(45)
      await expect(page.getByText(/45 min/).first()).toBeVisible()
    } finally {
      await deleteRecipeViaApi(page, id)
    }
  })
})

test.describe('Recipes: diet tags', () => {
  test('a tag the ingredients contradict is refused with the reason', async ({ page }) => {
    await page.getByText('+ Nueva Receta').click()
    await expect(page.getByPlaceholder('Nombre de la receta')).toBeVisible()
    await page.getByPlaceholder('Nombre de la receta').fill(`E2E Falso vegano ${Date.now()}`)
    await page.getByPlaceholder('Ingrediente').first().fill('Chorizo')
    await page.getByTestId('diet-chip-vegano').click()
    await page.getByText('Guardar Receta').click()
    await expect(page.getByTestId('recipe-diet-error')).toContainText(
      'Vegano: "Chorizo" parece no cumplirlo',
    )
  })

  // Auditar 2026-10-03: a celiac family's "Fideos sin TACC" was refused as gluten.
  test('a "sin TACC" product can be tagged Sin gluten', async ({ page }) => {
    const headers = await authHeaders(page)
    await page.getByText('+ Nueva Receta').click()
    const title = `E2E Sin TACC ${Date.now()}`
    await page.getByPlaceholder('Nombre de la receta').fill(title)
    await page.getByPlaceholder('Ingrediente').first().fill('Fideos sin TACC')
    await page.getByTestId('diet-chip-sin-gluten').click()
    await page.getByText('Guardar Receta').click()
    await expect(page).toHaveURL(/\/recipe\/[0-9a-f-]{36}/)
    const id = /\/recipe\/([0-9a-f-]{36})/.exec(page.url())![1]!
    try {
      const recipe = (await (
        await page.request.get(`${API_URL}/v1/recipes/${id}`, { headers })
      ).json()) as { dietaryTags: string[] }
      expect(recipe.dietaryTags).toEqual(['sin-gluten'])
    } finally {
      await deleteRecipeViaApi(page, id)
    }
  })

  // Auditar 2026-09-30: an empty list was sent as "leave unchanged", so the
  // last diet tag and food type could never be removed.
  test('unticking the last diet tag and food type on an edit clears them', async ({ page }) => {
    const headers = await authHeaders(page)
    const types = (await (
      await page.request.get(`${API_URL}/v1/food-types`, { headers })
    ).json()) as Array<{ id: string }>
    const foodTypeId = types[0]!.id
    const { id } = await createRecipeViaApi(page, {
      ingredients: [{ name: 'Lentejas', quantity: 200, unit: 'g' }],
      dietaryTags: ['vegano'],
      foodTypeIds: [foodTypeId],
    })
    try {
      const before = (await (
        await page.request.get(`${API_URL}/v1/recipes/${id}`, { headers })
      ).json()) as { dietaryTags: string[]; foodTypeIds: string[] }
      expect(before).toMatchObject({ dietaryTags: ['vegano'], foodTypeIds: [foodTypeId] })

      await page.goto(`/recipe/${id}/edit`)
      await page.getByTestId('diet-chip-vegano').click()
      await page.getByTestId(`food-type-chip-${foodTypeId}`).click()
      await page.getByText('Guardar Cambios').click()
      await expect(page.getByTestId('recipe-saved-banner')).toBeVisible()

      const recipe = (await (
        await page.request.get(`${API_URL}/v1/recipes/${id}`, { headers })
      ).json()) as { dietaryTags?: string[]; foodTypeIds?: string[] }
      expect(recipe.dietaryTags ?? []).toEqual([])
      expect(recipe.foodTypeIds ?? []).toEqual([])
    } finally {
      await deleteRecipeViaApi(page, id)
    }
  })
})

test.describe('Recipes: detail view', () => {
  test('recipe detail shows title and cook button', async ({ page }) => {
    await openSeededRecipe(page)
    await expect(page.getByText(SEEDED_RECIPE, { exact: true }).last()).toBeVisible()
  })

  test('servings stepper is visible in detail', async ({ page }) => {
    await openSeededRecipe(page)
    await expect(page.getByText(/Porciones:/i).first()).toBeVisible()
  })

  // Not the cook-mode recipe: its history fills with sessions while these run
  const openFirstRecipeDetail = (page: import('@playwright/test').Page) =>
    openSeededRecipe(page, 'Guiso de lentejas')

  test('unit toggle switches between cooking/metric/imperial', async ({ page }) => {
    await openFirstRecipeDetail(page)
    await expect(page.getByText('Métrico', { exact: true })).toBeVisible()
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
    await expect(page.getByText(/Editar Receta|Guardar Cambios/).first()).toBeVisible()
  })

  // Note: this intentionally saves WITHOUT changing anything — it covers the
  // edit form's load-populate-save round trip. Actually mutating the title
  // would permanently rename seeded demo recipes that other tests locate by
  // name (openSeededRecipe), breaking local reruns.
  test('saving the edit form without changes returns to detail', async ({ page }) => {
    await openFirstRecipeDetail(page)
    await page.getByText('Editar').click()
    await expect(page.getByText(/Editar Receta|Guardar Cambios/).first()).toBeVisible()
    // Save without changes — should return to detail
    await page.getByText(/Guardar Cambios|Guardar Receta/).click()
    await expect(page.getByTestId('recipe-detail-cook')).toBeVisible()
  })

  test('can set times and difficulty in the edit form and save', async ({ page }) => {
    await openFirstRecipeDetail(page)
    await page.getByText('Editar').click()
    await expect(page.getByTestId('recipe-prep-time')).toBeVisible()

    await page.getByTestId('recipe-prep-time').fill('8')
    await page.getByTestId('recipe-cook-time').fill('12')
    await page.getByTestId('difficulty-chip-media').click()

    await page.getByText(/Guardar Cambios|Guardar Receta/).click()
    await expect(page.getByTestId('recipe-detail-cook')).toBeVisible()
  })

  test('can add and remove an ingredient row in the edit form', async ({ page }) => {
    await openFirstRecipeDetail(page)
    await page.getByText('Editar').click()
    await expect(page.getByText(/Editar Receta|Guardar Cambios/).first()).toBeVisible()

    const nameInputs = page.getByPlaceholder('Ingrediente')
    const initialCount = await nameInputs.count()

    await page.getByText('+ Agregar ingrediente').click()
    await expect(nameInputs).toHaveCount(initialCount + 1)
    await nameInputs.last().fill('Perejil E2E')

    const newRow = nameInputs.last().locator('xpath=..')
    await newRow.getByText('✕').click()
    await expect(nameInputs).toHaveCount(initialCount)

    await page.getByText(/Guardar Cambios|Guardar Receta/).click()
    await expect(page.getByTestId('recipe-detail-cook')).toBeVisible()
  })

  test('can add and remove a step row in the edit form', async ({ page }) => {
    await openFirstRecipeDetail(page)
    await page.getByText('Editar').click()
    await expect(page.getByText(/Editar Receta|Guardar Cambios/).first()).toBeVisible()

    const stepInputs = page.getByPlaceholder(/Paso \d+/)
    const initialCount = await stepInputs.count()

    await page.getByText('+ Agregar paso').click()
    await expect(stepInputs).toHaveCount(initialCount + 1)
    await stepInputs.last().fill('Servir bien caliente.')

    const newRow = stepInputs.last().locator('xpath=..')
    await newRow.getByText('✕').click()
    await expect(stepInputs).toHaveCount(initialCount)

    await page.getByText(/Guardar Cambios|Guardar Receta/).click()
    await expect(page.getByTestId('recipe-detail-cook')).toBeVisible()
  })

  test('history tab: empty before cooking, then the session with its rating and note', async ({
    page,
  }) => {
    const headers = await authHeaders(page)
    const recipe = await createRecipeViaApi(page)
    try {
      await page.goto(`/recipe/${recipe.id}`)
      await page.getByTestId('recipe-tab-history').click()
      await expect(page.getByText('Todavía no cocinaste esta receta.')).toBeVisible()

      const log = await page.request.post(`${API_URL}/v1/cook-sessions`, {
        headers,
        data: { recipeId: recipe.id, rating: 4, notes: 'Salió rico (E2E historial)' },
      })
      expect(log.ok()).toBe(true)
      await page.reload()
      await page.getByTestId('recipe-tab-history').click()
      await expect(page.getByText('Salió rico (E2E historial)')).toBeVisible()
      await expect(page.getByText('Todavía no cocinaste esta receta.')).toHaveCount(0)
    } finally {
      await deleteRecipeViaApi(page, recipe.id)
    }
  })

  test('recipe tab returns from history to ingredients view', async ({ page }) => {
    await openFirstRecipeDetail(page)
    await page.getByTestId('recipe-tab-history').click()
    await page.getByTestId('recipe-tab-recipe').click()
    await expect(page.getByText('Ingredientes')).toBeVisible()
  })
})

test.describe('Recipes: times & difficulty', () => {
  test('creates a recipe with times + difficulty and filters by them', async ({ page }) => {
    const recipeName = `E2E Rápida ${Date.now()}`

    await page.getByText('+ Nueva Receta').click()
    await expect(page.getByPlaceholder('Nombre de la receta')).toBeVisible()
    await page.getByPlaceholder('Nombre de la receta').fill(recipeName)
    await page.getByPlaceholder('Ingrediente').first().fill('Agua')
    await page.getByPlaceholder('Cant.').first().fill('1')
    await page.getByPlaceholder(/Paso 1/i).fill('Calentar.')

    // Times + difficulty (total = 15 min, fácil)
    await page.getByTestId('recipe-prep-time').fill('5')
    await page.getByTestId('recipe-cook-time').fill('10')
    await page.getByTestId('difficulty-chip-fácil').click()

    await page.getByText('Guardar Receta').click()
    await expect(page.getByTestId('recipe-saved-banner')).toBeVisible()
    await page.goBack()
    await expect(page.getByText(recipeName)).toBeVisible()

    // Compact "⏱ 15 min · fácil" line renders on the card.
    await expect(page.getByText('⏱ 15 min · fácil').first()).toBeVisible()

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

// Story "App: dietary tags picker in recipe form + allergen warning": "Home
// screen: dietary filter in search combines with food type filter".
test.describe('Home: diet filter combined with food type', () => {
  test('vegan + a food type shows only the vegan recipes of that type', async ({ page }) => {
    const token = await page.evaluate(() => localStorage.getItem('auth_token'))
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    const types = (await (
      await page.request.get(`${API_URL}/v1/food-types`, { headers })
    ).json()) as { id: string; name: string }[]
    const type = types[0]! // shown among the home chips
    const stamp = `Dieta${Date.now()}`
    const created: string[] = []
    const make = async (title: string, dietaryTags: string[], withType: boolean) => {
      const res = await page.request.post(`${API_URL}/v1/recipes`, {
        headers,
        data: {
          title: `${stamp} ${title}`,
          servings: 2,
          category: 'Cena',
          ingredients: [{ name: 'banana', quantity: 1, unit: 'unit' }],
          steps: [{ text: 'Servir.' }],
          dietaryTags,
          ...(withType ? { foodTypeIds: [type.id] } : {}),
        },
      })
      expect(res.ok()).toBe(true)
      created.push(((await res.json()) as { id: string }).id)
    }
    try {
      await make('vegana del tipo', ['vegano'], true)
      await make('no vegana del tipo', [], true)
      await make('vegana de otro tipo', ['vegano'], false)

      await page.goto('/')
      await page.getByPlaceholder(/buscar recetas/i).fill(stamp)
      await expect(page.getByText(`${stamp} vegana del tipo`)).toBeVisible()
      await expect(page.getByText(new RegExp(stamp))).toHaveCount(3)

      await page.getByTestId(`home-type-chip-${type.id}`).click()
      await expect(page.getByText(new RegExp(stamp))).toHaveCount(2)
      await page.getByTestId('home-diet-chip-vegano').click()
      await expect(page.getByText(new RegExp(stamp))).toHaveCount(1)
      // The selected diet is highlighted (chip and label), the others are not
      const look = (tag: string) =>
        page.getByTestId(`home-diet-chip-${tag}`).evaluate((el) => {
          const text = el.querySelector('div') ?? el
          return [getComputedStyle(el).backgroundColor, getComputedStyle(text).color]
        })
      const [on, off] = await Promise.all([look('vegano'), look('keto')])
      expect(on[0]).not.toBe(off[0])
      expect(on[1]).not.toBe(off[1])
      await expect(page.getByText(`${stamp} vegana del tipo`)).toBeVisible()

      // "Todas" clears both filters
      await page.getByTestId('home-type-chip-all').click()
      await expect(page.getByText(new RegExp(stamp))).toHaveCount(3)
      await expect(page.getByTestId('home-diet-chip-vegano')).toHaveAttribute(
        'aria-selected',
        'false',
      )
    } finally {
      for (const id of created)
        await page.request.delete(`${API_URL}/v1/recipes/${id}`, { headers })
    }
  })
})

// 2026-10-02 review: home asked for one page of 50 recipes, so with more than
// that the oldest never showed and the time filter only searched the newest 50.
test('home reaches recipes past the first page (the time filter finds an old one)', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const stamp = Date.now()
  const old = await createRecipeViaApi(page, { title: `E2E Vieja ${stamp}`, totalTimeMin: 7 })
  const newer: string[] = []
  try {
    for (let i = 0; i < 100; i++) {
      newer.push(
        (await createRecipeViaApi(page, { title: `E2E Nueva ${stamp}-${i}`, totalTimeMin: 95 })).id,
      )
    }
    await page.goto('/')
    await page.getByTestId('filter-time-20').click()
    await expect(page.getByTestId(`recipe-card-${old.id}`)).toBeVisible()
  } finally {
    for (const id of [old.id, ...newer]) await deleteRecipeViaApi(page, id)
  }
})

// 2026-10-02 review: the form read quantities with parseFloat, so the decimal
// comma used here ("1,5") was saved as 1 without a word.
test('a quantity typed with a decimal comma is saved as written', async ({ page }) => {
  const headers = await authHeaders(page)
  const title = `E2E Coma ${Date.now()}`
  let recipeId: string | undefined
  try {
    await page.goto('/recipe/new')
    await page.getByPlaceholder('Nombre de la receta').fill(title)
    await page.getByPlaceholder('Ingrediente').first().fill('Harina')
    await page.getByPlaceholder('Cant.').first().fill('1,5')
    await page.getByText('Guardar Receta').click()
    await expect(page.getByTestId('recipe-saved-banner')).toBeVisible()
    recipeId = page.url().split('/recipe/')[1]?.split(/[?#]/)[0]
    const saved = (await (
      await page.request.get(`${API_URL}/v1/recipes/${recipeId}`, { headers })
    ).json()) as { ingredients: { quantity: number }[] }
    expect(saved.ingredients[0]?.quantity).toBe(1.5)
  } finally {
    if (recipeId) await deleteRecipeViaApi(page, recipeId)
  }
})
