import { test, expect } from './fixtures'

/**
 * Targeted coverage for flows no other suite exercises:
 * - stats screen with real data (top recipes + frequency chart + tap-through)
 * - picking a recipe from the menu pick screen (creates the entry for real)
 * - API error paths surfaced via notify() using Playwright route interception
 * Every entity created here is cleaned up so seeded demo data stays stable.
 */

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000'

async function authHeaders(page: import('@playwright/test').Page) {
  const token = await page.evaluate(() => localStorage.getItem('auth_token'))
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

test.describe('Stats screen with data', () => {
  test('shows top recipes and frequency chart after a cook session, and taps through', async ({
    page,
  }) => {
    const headers = await authHeaders(page)
    const recipeRes = await page.request.post(`${API_URL}/v1/recipes`, {
      headers,
      data: {
        title: `E2E Stats ${Date.now()}`,
        servings: 2,
        category: 'Cena',
        ingredients: [{ name: 'sal', quantity: 1, unit: 'g' }],
        steps: [{ text: 'Único paso.' }],
      },
    })
    expect(recipeRes.ok()).toBe(true)
    const recipe = (await recipeRes.json()) as { id: string }
    const sessionRes = await page.request.post(`${API_URL}/v1/cook-sessions`, {
      headers,
      data: { recipeId: recipe.id, rating: 5 },
    })
    expect(sessionRes.ok()).toBe(true)

    try {
      await page.goto('/stats')
      await expect(page.getByText('Recetas más cocinadas')).toBeVisible({ timeout: 8000 })
      // Non-empty branches: ranked row with count badge + weekly frequency bar
      await expect(page.getByText('#1')).toBeVisible({ timeout: 8000 })
      await expect(page.getByText(/\d+×/).first()).toBeVisible()
      await expect(page.getByText('Frecuencia semanal')).toBeVisible()

      // Tapping OUR recipe's row navigates to its detail (#1 might be an
      // older, since-deleted session's row, which renders unclickable)
      await page.getByText(`${recipe.id.slice(0, 8)}…`).click()
      await expect(page.getByTestId('recipe-detail-cook')).toBeVisible({ timeout: 10000 })
    } finally {
      await page.request.delete(`${API_URL}/v1/recipes/${recipe.id}`, { headers })
    }
  })
})

test.describe('Pick screen: actually picking a recipe', () => {
  test('tapping a recipe adds it to the slot and returns to the planner', async ({ page }) => {
    const headers = await authHeaders(page)
    // A far-future week so the current-week assertions of other suites never
    // see this entry, even if cleanup fails.
    const date = '2027-03-10'
    await page.goto(`/menu/pick?date=${date}&slot=Cena&weekStart=2027-03-08`)
    const firstRecipe = page.locator('[data-testid^="pick-recipe-"]').first()
    await expect(firstRecipe).toBeVisible({ timeout: 10000 })
    const pickedId = (await firstRecipe.getAttribute('data-testid'))!.replace('pick-recipe-', '')

    try {
      // The FlatList can re-render between resolving the locator and the click
      // landing (react-query refetch), silently dropping the press. Retry the
      // whole click→response block until the POST is actually observed.
      await expect(async () => {
        const [addRes] = await Promise.all([
          page.waitForResponse(
            (r) => r.url().includes('/v1/menu') && r.request().method() === 'POST',
            { timeout: 2000 },
          ),
          firstRecipe.click(),
        ])
        expect(addRes.status()).toBe(200)
      }).toPass({ timeout: 15000 })
      // onSuccess runs router.back(); entering pick via direct URL leaves no
      // history, so on web that navigation may no-op — the reliable success
      // signal is the entry existing server-side.

      const weekRes = await page.request.get(`${API_URL}/v1/menu?weekStart=2027-03-08`, {
        headers,
      })
      const entries = (await weekRes.json()) as { recipeId: string | null }[]
      expect(entries.some((e) => e.recipeId === pickedId)).toBe(true)
    } finally {
      await page.request.delete(`${API_URL}/v1/menu/${date}/Cena/${pickedId}`, { headers })
    }
  })
})

test.describe('API error paths (route interception)', () => {
  test('a 500 while adding to the menu surfaces the error notification', async ({ page }) => {
    await page.route('**/v1/menu', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 500, body: JSON.stringify({ error: 'boom' }) })
        : route.fallback(),
    )

    let dialogMessage = ''
    page.on('dialog', (dialog) => {
      dialogMessage = dialog.message()
      void dialog.accept()
    })

    await page.goto(`/menu/pick?date=2027-03-11&slot=Cena&weekStart=2027-03-08`)
    const firstRecipe = page.locator('[data-testid^="pick-recipe-"]').first()
    await expect(firstRecipe).toBeVisible({ timeout: 10000 })
    await firstRecipe.click()
    await expect.poll(() => dialogMessage, { timeout: 8000 }).toContain('Error')
  })

  test('a 500 while deleting a taxonomy item surfaces the error notification', async ({ page }) => {
    const headers = await authHeaders(page)
    // A custom food type so the delete affordance is guaranteed to render
    const ftRes = await page.request.post(`${API_URL}/v1/food-types`, {
      headers,
      data: { name: `E2E Borrable ${Date.now()}` },
    })
    expect(ftRes.ok()).toBe(true)
    const foodType = (await ftRes.json()) as { id: string }

    await page.route(`**/v1/config/food-types/${foodType.id}*`, (route) =>
      route.request().method() === 'DELETE'
        ? route.fulfill({ status: 500, body: JSON.stringify({ error: 'boom' }) })
        : route.fallback(),
    )

    let dialogMessage = ''
    page.on('dialog', (dialog) => {
      dialogMessage = dialog.message()
      void dialog.accept()
    })

    try {
      await page.goto('/config')
      await page.getByTestId('config-tab-food-types').click()
      const deleteBtn = page.getByTestId(`config-delete-${foodType.id}`)
      await expect(deleteBtn).toBeVisible({ timeout: 8000 })
      await deleteBtn.click()
      await expect(page.getByTestId('config-delete-confirm')).toBeVisible({ timeout: 5000 })
      await page.getByTestId('config-delete-confirm').click()
      await expect.poll(() => dialogMessage, { timeout: 8000 }).toContain('Error')
    } finally {
      await page.unroute(`**/v1/config/food-types/${foodType.id}*`)
      await page.request.delete(`${API_URL}/v1/config/food-types/${foodType.id}`, { headers })
    }
  })

  test('deleting a custom food type for real removes it from the list', async ({ page }) => {
    const headers = await authHeaders(page)
    const ftRes = await page.request.post(`${API_URL}/v1/food-types`, {
      headers,
      data: { name: `E2E Eliminable ${Date.now()}` },
    })
    expect(ftRes.ok()).toBe(true)
    const foodType = (await ftRes.json()) as { id: string }

    await page.goto('/config')
    await page.getByTestId('config-tab-food-types').click()
    const deleteBtn = page.getByTestId(`config-delete-${foodType.id}`)
    await expect(deleteBtn).toBeVisible({ timeout: 8000 })
    await deleteBtn.click()
    await expect(page.getByTestId('config-delete-confirm')).toBeVisible({ timeout: 5000 })
    await page.getByTestId('config-delete-confirm').click()
    await expect(deleteBtn).not.toBeVisible({ timeout: 8000 })
  })
})

// ---------------------------------------------------------------------------
// Round 2: menu planner deep flows, recipe detail deep flows, form branches,
// ErrorBoundary, and more error paths. Same hygiene: everything created is
// cleaned up; interceptions are page-scoped.
// ---------------------------------------------------------------------------

async function createRecipeViaApi(
  page: import('@playwright/test').Page,
  overrides: Record<string, unknown> = {},
) {
  const headers = await authHeaders(page)
  const res = await page.request.post(`${API_URL}/v1/recipes`, {
    headers,
    data: {
      title: `E2E Gaps2 ${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      servings: 2,
      category: 'Cena',
      ingredients: [{ name: 'agua', quantity: 1, unit: 'l' }],
      steps: [{ text: 'Paso único.' }],
      ...overrides,
    },
  })
  expect(res.ok()).toBe(true)
  return (await res.json()) as { id: string; title: string }
}

async function deleteRecipeViaApi(page: import('@playwright/test').Page, id: string) {
  const headers = await authHeaders(page)
  await page.request.delete(`${API_URL}/v1/recipes/${id}`, { headers })
}

test.describe('Recipe detail: deep flows', () => {
  test('unknown recipe id shows the not-found state', async ({ page }) => {
    await page.goto('/recipe/00000000-0000-4000-8000-000000000000')
    await expect(page.getByText('Receta no encontrada')).toBeVisible({ timeout: 10000 })
  })

  test('servings stepper rescales ingredients and nutrition', async ({ page }) => {
    const recipe = await createRecipeViaApi(page, {
      nutrition: { calories: 400, protein_g: 20, carbs_g: 40, fat_g: 10 },
    })
    try {
      await page.goto(`/recipe/${recipe.id}`)
      await expect(page.getByTestId('recipe-detail-cook')).toBeVisible({ timeout: 10000 })
      await expect(page.getByText(/1\s*l/).first()).toBeVisible()

      // + rescales: 2 → 3 servings means 1 l → 1.5 l
      await page.getByText('+', { exact: true }).first().click()
      await expect(page.getByText(/1[.,]5\s*l/).first()).toBeVisible({ timeout: 5000 })
      // − returns to base
      await page.getByText('−', { exact: true }).first().click()
      await expect(page.getByText(/1\s*l/).first()).toBeVisible({ timeout: 5000 })
    } finally {
      await deleteRecipeViaApi(page, recipe.id)
    }
  })

  test('related recipes section navigates to the related recipe', async ({ page }) => {
    const headers = await authHeaders(page)
    const a = await createRecipeViaApi(page)
    const b = await createRecipeViaApi(page)
    try {
      const relRes = await page.request.post(`${API_URL}/v1/recipes/${a.id}/relations`, {
        headers,
        data: { toId: b.id, relationType: 'similar' },
      })
      expect(relRes.ok()).toBe(true)

      await page.goto(`/recipe/${a.id}`)
      await expect(page.getByText('Te puede gustar')).toBeVisible({ timeout: 10000 })
      await page.locator('text=Te puede gustar').locator('xpath=following-sibling::*[1]').click()
      await expect(page.getByText(b.title)).toBeVisible({ timeout: 10000 })
    } finally {
      await deleteRecipeViaApi(page, a.id)
      await deleteRecipeViaApi(page, b.id)
    }
  })
})

test.describe('Menu planner: deep flows', () => {
  async function ensureRecipeInMenu(page: import('@playwright/test').Page) {
    await page.getByText('Menú Semanal').click()
    await expect(page.locator('[data-testid^="menu-add-"]').first()).toBeVisible({ timeout: 8000 })
    const chip = page.locator('[data-testid^="menu-entry-"]').first()
    if ((await chip.count()) === 0) {
      await page.locator('[data-testid^="menu-add-"]').first().click()
      const firstPickItem = page.locator('[data-testid^="pick-recipe-"]').first()
      await expect(firstPickItem).toBeVisible({ timeout: 15000 })
      await firstPickItem.click()
      await page.waitForLoadState('networkidle', { timeout: 15000 })
    }
    await expect(page.locator('[data-testid^="menu-entry-"]').first()).toBeVisible({
      timeout: 8000,
    })
  }

  test('the ✕ chip removes an entry directly from the grid', async ({ page }) => {
    await ensureRecipeInMenu(page)
    const removeBtn = page.locator('[data-testid^="menu-remove-"]').first()
    await expect(removeBtn).toBeVisible({ timeout: 8000 })
    const before = await page.locator('[data-testid^="menu-entry-"]').count()
    await removeBtn.click()
    await expect(page.locator('[data-testid^="menu-entry-"]')).toHaveCount(before - 1, {
      timeout: 8000,
    })
  })

  test('the edit modal can decrement servings and delete the entry', async ({ page }) => {
    await ensureRecipeInMenu(page)
    const chip = page.locator('[data-testid^="menu-entry-"]').first()
    await chip.click()
    await expect(page.getByTestId('menu-modal-save')).toBeVisible({ timeout: 8000 })

    // − branch inside the modal (clamps at 1)
    await page.getByText('−', { exact: true }).last().click()

    const before = await page.locator('[data-testid^="menu-entry-"]').count()
    await page.getByTestId('menu-modal-delete').click()
    await expect(page.getByTestId('menu-modal-save')).not.toBeVisible({ timeout: 8000 })
    await expect(page.locator('[data-testid^="menu-entry-"]')).toHaveCount(before - 1, {
      timeout: 8000,
    })
  })

  test('a 500 loading the week shows the planner error state', async ({ page }) => {
    await page.route('**/v1/menu?*', (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'boom' }) }),
    )
    await page.getByText('Menú Semanal').click()
    await expect(page.getByText('Error al cargar el menú')).toBeVisible({ timeout: 15000 })
  })

  test('a 500 removing an entry surfaces the error notification', async ({ page }) => {
    await ensureRecipeInMenu(page)
    await page.route('**/v1/menu/**', (route) =>
      route.request().method() === 'DELETE'
        ? route.fulfill({ status: 500, body: JSON.stringify({ error: 'boom' }) })
        : route.fallback(),
    )
    let dialogMessage = ''
    page.on('dialog', (dialog) => {
      dialogMessage = dialog.message()
      void dialog.accept()
    })
    await page.locator('[data-testid^="menu-remove-"]').first().click()
    await expect.poll(() => dialogMessage, { timeout: 8000 }).toContain('Error')
  })

  test('a 500 updating servings surfaces the error notification', async ({ page }) => {
    await ensureRecipeInMenu(page)
    await page.route('**/v1/menu/**', (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({ status: 500, body: JSON.stringify({ error: 'boom' }) })
        : route.fallback(),
    )
    let dialogMessage = ''
    page.on('dialog', (dialog) => {
      dialogMessage = dialog.message()
      void dialog.accept()
    })
    await page.locator('[data-testid^="menu-entry-"]').first().click()
    await expect(page.getByTestId('menu-modal-save')).toBeVisible({ timeout: 8000 })
    await page.getByTestId('menu-modal-save').click()
    await expect.poll(() => dialogMessage, { timeout: 8000 }).toContain('Error')
  })
})

test.describe('New recipe form: row management and error branches', () => {
  test('add/remove ingredient and step rows work in the create form', async ({ page }) => {
    await page.getByText('+ Nueva Receta').click()
    await expect(page.getByPlaceholder('Nombre de la receta')).toBeVisible({ timeout: 10000 })

    const nameInputs = page.getByPlaceholder('Ingrediente')
    const initialIngredients = await nameInputs.count()
    await page.getByText('+ Agregar ingrediente').click()
    await expect(nameInputs).toHaveCount(initialIngredients + 1)
    // presentation input + unit chip on the new row
    await page.getByPlaceholder('Picado, etc.').last().fill('picado fino')
    await nameInputs.last().locator('xpath=..').getByText('✕').click()
    await expect(nameInputs).toHaveCount(initialIngredients)

    const stepInputs = page.getByPlaceholder(/Paso \d+/)
    const initialSteps = await stepInputs.count()
    await page.getByText('+ Agregar paso').click()
    await expect(stepInputs).toHaveCount(initialSteps + 1)
    await stepInputs.last().locator('xpath=..').getByText('✕').click()
    await expect(stepInputs).toHaveCount(initialSteps)

    // category chip branch — 'Desayuno' is a category but NOT a food type,
    // so it can't resolve to a FoodTypePicker chip (which happened on CI)
    await page.getByText('Desayuno', { exact: true }).click()
    await expect(page.getByPlaceholder('Nombre de la receta')).toBeVisible()
  })

  test('a 500 creating the recipe shows the general error', async ({ page }) => {
    await page.route('**/v1/recipes', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 500, body: JSON.stringify({ error: 'boom' }) })
        : route.fallback(),
    )
    await page.getByText('+ Nueva Receta').click()
    await expect(page.getByPlaceholder('Nombre de la receta')).toBeVisible({ timeout: 10000 })
    await page.getByPlaceholder('Nombre de la receta').fill('Receta Que Falla')
    await page.getByPlaceholder('Ingrediente').first().fill('sal')
    await page.getByText('Guardar Receta').click()
    await expect(page.getByText(/API 500/).first()).toBeVisible({ timeout: 8000 })
  })
})

test.describe('Edit recipe form: validation and error branches', () => {
  test('clearing the title and saving shows a validation error', async ({ page }) => {
    const recipe = await createRecipeViaApi(page)
    try {
      await page.goto(`/recipe/${recipe.id}/edit`)
      await expect(page.getByText('Editar Receta').first()).toBeVisible({ timeout: 10000 })
      const title = page.getByPlaceholder('Nombre de la receta')
      await expect(title).toHaveValue(recipe.title, { timeout: 8000 })
      await title.fill('')
      // touch category + ingredient field branches while we're here
      await page.getByText('Almuerzo', { exact: true }).click()
      await page.getByPlaceholder('Cant.').first().fill('3')
      await page.getByPlaceholder('Unidad').first().fill('l')
      await page.getByPlaceholder('Picado...').first().fill('fría')
      await page.getByText('Guardar Cambios').click()
      await expect(page.getByText(/Too small|obligatorio|título/i).first()).toBeVisible({
        timeout: 8000,
      })
    } finally {
      await deleteRecipeViaApi(page, recipe.id)
    }
  })

  test('a 500 saving the edit shows the general error', async ({ page }) => {
    const recipe = await createRecipeViaApi(page)
    try {
      await page.route(`**/v1/recipes/${recipe.id}`, (route) =>
        route.request().method() === 'PUT'
          ? route.fulfill({ status: 500, body: JSON.stringify({ error: 'boom' }) })
          : route.fallback(),
      )
      await page.goto(`/recipe/${recipe.id}/edit`)
      await expect(page.getByPlaceholder('Nombre de la receta')).toHaveValue(recipe.title, {
        timeout: 10000,
      })
      await page.getByText('Guardar Cambios').click()
      await expect(page.getByText(/API 500/).first()).toBeVisible({ timeout: 8000 })
    } finally {
      await page.unroute(`**/v1/recipes/${recipe.id}`)
      await deleteRecipeViaApi(page, recipe.id)
    }
  })
})

test.describe('Stats: empty state branches', () => {
  test('zeroed stats show both empty messages', async ({ page }) => {
    await page.route('**/v1/cook-sessions/stats*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ totalSessions: 0, topRecipes: [], frequencyByWeek: [] }),
      }),
    )
    await page.goto('/stats')
    await expect(page.getByText(/¡Empezá a cocinar/)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Todavía no hay sesiones de cocina registradas.')).toBeVisible()
  })
})
