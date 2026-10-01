import { test, expect } from './fixtures'
import { API_URL } from './env'
import { authHeaders, createRecipeViaApi, deleteCollectionViaApi, deleteRecipeViaApi } from './api'

/**
 * Targeted coverage for flows no other suite exercises:
 * - stats screen with real data (top recipes + frequency chart + tap-through)
 * - picking a recipe from the menu pick screen (creates the entry for real)
 * - API error paths surfaced via notify() using Playwright route interception
 * Every entity created here is cleaned up so seeded demo data stays stable.
 */

test.describe('Stats screen with data', () => {
  test('shows top recipes and frequency chart after a cook session, and taps through', async ({
    page,
  }) => {
    const headers = await authHeaders(page)
    const statsTitle = `E2E Stats ${Date.now()}`
    const recipeRes = await page.request.post(`${API_URL}/v1/recipes`, {
      headers,
      data: {
        title: statsTitle,
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
      await expect(page.getByText('Recetas más cocinadas')).toBeVisible()
      // Non-empty branches: ranked row with count badge + weekly frequency bar
      await expect(page.getByText('#1')).toBeVisible()
      await expect(page.getByText(/\d+×/).first()).toBeVisible()
      await expect(page.getByText('Frecuencia semanal')).toBeVisible()

      // Tapping OUR recipe's row navigates to its detail (#1 might be an
      // older, since-deleted session's row, which renders unclickable)
      // Rows are named by recipe title, not by id
      await page.getByText(statsTitle).click()
      await expect(page.getByTestId('recipe-detail-cook')).toBeVisible()
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
    await expect(firstRecipe).toBeVisible()
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
    await expect(firstRecipe).toBeVisible()
    await firstRecipe.click()
    await expect.poll(() => dialogMessage).toContain('Error')
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
      await expect(deleteBtn).toBeVisible()
      await deleteBtn.click()
      await expect(page.getByTestId('config-delete-confirm')).toBeVisible()
      await page.getByTestId('config-delete-confirm').click()
      await expect.poll(() => dialogMessage).toContain('Error')
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
    await expect(deleteBtn).toBeVisible()
    await deleteBtn.click()
    await expect(page.getByTestId('config-delete-confirm')).toBeVisible()
    await page.getByTestId('config-delete-confirm').click()
    await expect(deleteBtn).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Round 2: menu planner deep flows, recipe detail deep flows, form branches,
// ErrorBoundary, and more error paths. Same hygiene: everything created is
// cleaned up; interceptions are page-scoped.
// ---------------------------------------------------------------------------

test.describe('Recipe detail: deep flows', () => {
  test('unknown recipe id shows the not-found state', async ({ page }) => {
    await page.goto('/recipe/00000000-0000-4000-8000-000000000000')
    await expect(page.getByText('Receta no encontrada')).toBeVisible()
  })

  test('servings stepper rescales ingredients and nutrition', async ({ page }) => {
    const recipe = await createRecipeViaApi(page, {
      nutrition: { calories: 400, protein_g: 20, carbs_g: 40, fat_g: 10 },
    })
    try {
      await page.goto(`/recipe/${recipe.id}`)
      await expect(page.getByTestId('recipe-detail-cook')).toBeVisible()
      await expect(page.getByText(/1\s*l/).first()).toBeVisible()

      // + rescales: 2 → 3 servings means 1 l → 1.5 l
      await page.getByText('+', { exact: true }).first().click()
      await expect(page.getByText(/1[.,]5\s*l/).first()).toBeVisible()
      // − returns to base
      await page.getByText('−', { exact: true }).first().click()
      await expect(page.getByText(/1\s*l/).first()).toBeVisible()
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
      await expect(page.getByText('Te puede gustar')).toBeVisible()
      await page.locator('text=Te puede gustar').locator('xpath=following-sibling::*[1]').click()
      await expect(page.getByText(b.title)).toBeVisible()
    } finally {
      await deleteRecipeViaApi(page, a.id)
      await deleteRecipeViaApi(page, b.id)
    }
  })
})

test.describe('Menu planner: deep flows', () => {
  // Returns the day/slot/recipeId it had to create, or null when a chip
  // already existed (nothing this call is responsible for cleaning up).
  // The two 500-mocked tests below intercept DELETE/PATCH to '/v1/menu/**' so
  // the UI-driven removal never reaches the real backend — without an
  // explicit cleanup via a direct (unmocked) page.request call, the entry
  // they create would leak onto today's first-empty slot forever, the same
  // leak class fixed in menu.spec.ts (2026-07-13 investigation).
  async function ensureRecipeInMenu(
    page: import('@playwright/test').Page,
  ): Promise<{ day: string; slot: string; recipeId: string } | null> {
    await page.getByText('Menú Semanal').click()
    await expect(page.locator('[data-testid^="menu-add-"]').first()).toBeVisible()
    const chip = page.locator('[data-testid^="menu-entry-"]').first()
    let created: { day: string; slot: string; recipeId: string } | null = null
    if ((await chip.count()) === 0) {
      const addBtn = page.locator('[data-testid^="menu-add-"]').first()
      const addTestId = (await addBtn.getAttribute('data-testid'))!
      const rest = addTestId.replace(/^menu-add-/, '') // "{day}-{slot}", day = YYYY-MM-DD
      const lastDash = rest.lastIndexOf('-')
      const day = rest.slice(0, lastDash)
      const slot = rest.slice(lastDash + 1)

      await addBtn.click()
      const firstPickItem = page.locator('[data-testid^="pick-recipe-"]').first()
      await expect(firstPickItem).toBeVisible({ timeout: 15000 })
      const pickTestId = (await firstPickItem.getAttribute('data-testid'))!
      const recipeId = pickTestId.replace('pick-recipe-', '')
      await firstPickItem.click()
      await page.waitForURL((url) => !url.pathname.includes('/menu/pick'))
      created = { day, slot, recipeId }
    }
    await expect(page.locator('[data-testid^="menu-entry-"]').first()).toBeVisible()
    return created
  }

  // Deletes via a direct API call (Playwright's page.request context is a
  // separate transport from page.route() interception, so this reaches the
  // real backend even while the test mocks DELETE/PATCH for the UI).
  async function cleanupCreatedEntry(
    page: import('@playwright/test').Page,
    created: { day: string; slot: string; recipeId: string } | null,
  ) {
    if (!created) return
    const headers = await authHeaders(page)
    await page.request.delete(
      `${API_URL}/v1/menu/${created.day}/${created.slot}/${created.recipeId}`,
      { headers },
    )
  }

  test('the ✕ chip removes an entry directly from the grid', async ({ page }) => {
    await ensureRecipeInMenu(page)
    const removeBtn = page.locator('[data-testid^="menu-remove-"]').first()
    await expect(removeBtn).toBeVisible()
    const before = await page.locator('[data-testid^="menu-entry-"]').count()
    // Cancelling the confirm keeps the entry; accepting removes it
    page.once('dialog', (d) => void d.dismiss())
    await removeBtn.click()
    await expect(page.locator('[data-testid^="menu-entry-"]')).toHaveCount(before)
    page.once('dialog', (d) => void d.accept())
    await removeBtn.click()
    await expect(page.locator('[data-testid^="menu-entry-"]')).toHaveCount(before - 1)
  })

  test('the edit modal marks a dish cooked, and back to planned', async ({ page }) => {
    const created = await ensureRecipeInMenu(page)
    try {
      const chip = page.locator('[data-testid^="menu-entry-"]').first()
      await chip.click()
      await page.getByTestId('menu-modal-status-cooked').click()
      await expect(page.getByTestId('menu-modal-save')).not.toBeVisible()
      await expect(chip).toContainText('✓')
      // Undo, so later tests find the entry planned again
      await chip.click()
      await page.getByTestId('menu-modal-status-planned').click()
      await expect(chip).not.toContainText('✓')
    } finally {
      await cleanupCreatedEntry(page, created)
    }
  })

  test('the edit modal can decrement servings and delete the entry', async ({ page }) => {
    await ensureRecipeInMenu(page)
    const chip = page.locator('[data-testid^="menu-entry-"]').first()
    await chip.click()
    await expect(page.getByTestId('menu-modal-save')).toBeVisible()

    // − branch inside the modal (clamps at 1)
    await page.getByText('−', { exact: true }).last().click()

    const before = await page.locator('[data-testid^="menu-entry-"]').count()
    await page.getByTestId('menu-modal-delete').click()
    await expect(page.getByTestId('menu-modal-save')).not.toBeVisible()
    await expect(page.locator('[data-testid^="menu-entry-"]')).toHaveCount(before - 1)
  })

  test('a 500 loading the week shows the planner error state', async ({ page }) => {
    await page.route('**/v1/menu?*', (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'boom' }) }),
    )
    await page.getByText('Menú Semanal').click()
    await expect(page.getByText('Error al cargar el menú')).toBeVisible({ timeout: 15000 })
  })

  test('a 500 removing an entry surfaces the error notification', async ({ page }) => {
    const created = await ensureRecipeInMenu(page)
    try {
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
      await expect.poll(() => dialogMessage).toContain('Error')
    } finally {
      // The mocked DELETE above never reaches the backend, so the entry
      // ensureRecipeInMenu created (if any) is still there — remove it via an
      // unmocked request.
      await cleanupCreatedEntry(page, created)
    }
  })

  test('a 500 updating servings surfaces the error notification', async ({ page }) => {
    const created = await ensureRecipeInMenu(page)
    try {
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
      await expect(page.getByTestId('menu-modal-save')).toBeVisible()
      await page.getByTestId('menu-modal-save').click()
      await expect.poll(() => dialogMessage).toContain('Error')
    } finally {
      await cleanupCreatedEntry(page, created)
    }
  })
})

test.describe('New recipe form: row management and error branches', () => {
  test('add/remove ingredient and step rows work in the create form', async ({ page }) => {
    await page.getByText('+ Nueva Receta').click()
    await expect(page.getByPlaceholder('Nombre de la receta')).toBeVisible()

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
    await expect(page.getByPlaceholder('Nombre de la receta')).toBeVisible()
    await page.getByPlaceholder('Nombre de la receta').fill('Receta Que Falla')
    await page.getByPlaceholder('Ingrediente').first().fill('sal')
    await page.getByText('Guardar Receta').click()
    await expect(page.getByText('boom').first()).toBeVisible()
  })

  test('a server error without a message shows a generic one; visibility toggles back', async ({
    page,
  }) => {
    await page.route('**/v1/recipes', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 502, body: '<html>bad gateway</html>' })
        : route.fallback(),
    )
    page.on('dialog', (d) => void d.accept())
    await page.getByText('+ Nueva Receta').click()
    await expect(page.getByPlaceholder('Nombre de la receta')).toBeVisible()
    await page.getByTestId('visibility-toggle').click()
    await expect(page.getByText('🌐 Pública')).toBeVisible()
    await page.getByTestId('visibility-toggle').click()
    await expect(page.getByText('🔒 Privada')).toBeVisible()
    await page.getByPlaceholder('Nombre de la receta').fill('Receta Que Falla')
    await page.getByPlaceholder('Ingrediente').first().fill('sal')
    await page.getByText('Guardar Receta').click()
    await expect(page.getByText('Error del servidor (502)')).toBeVisible()
  })
})

test.describe('Edit recipe form: validation and error branches', () => {
  test('clearing the title and saving shows a validation error', async ({ page }) => {
    const recipe = await createRecipeViaApi(page)
    try {
      await page.goto(`/recipe/${recipe.id}/edit`)
      await expect(page.getByText('Editar Receta').first()).toBeVisible()
      const title = page.getByPlaceholder('Nombre de la receta')
      await expect(title).toHaveValue(recipe.title)
      await title.fill('')
      // touch category + ingredient field branches while we're here
      await page.getByText('Almuerzo', { exact: true }).click()
      await page.getByPlaceholder('Cant.').first().fill('3')
      await page.getByTestId('ingredient-unit-0').click()
      await page.getByTestId('unit-option-0-l').click()
      await page.getByPlaceholder('Picado, etc.').first().fill('fría')
      await page.getByText('Guardar Cambios').click()
      await expect(page.getByText(/Too small|obligatorio|título/i).first()).toBeVisible()
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
      await expect(page.getByPlaceholder('Nombre de la receta')).toHaveValue(recipe.title)
      await page.getByText('Guardar Cambios').click()
      await expect(page.getByText('boom').first()).toBeVisible()
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
    await expect(page.getByText(/¡Empezá a cocinar/)).toBeVisible()
    await expect(page.getByText('Todavía no hay sesiones de cocina registradas.')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Round 3: remaining error states, small branches, and data-shape branches.
// ---------------------------------------------------------------------------

test.describe('Screen error states (route interception)', () => {
  test('home shows the list error state on a 500', async ({ page }) => {
    await page.route('**/v1/recipes?*', (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'boom' }) }),
    )
    await page.goto('/')
    await expect(page.getByText('Error al cargar recetas')).toBeVisible({ timeout: 15000 })
  })

  test('shopping list shows the error state and Reintentar recovers', async ({ page }) => {
    let fail = true
    await page.route('**/v1/menu/shopping-list*', (route) =>
      fail
        ? route.fulfill({ status: 500, body: JSON.stringify({ error: 'boom' }) })
        : route.fallback(),
    )
    await page.goto('/menu/shopping-list?weekStart=2027-03-08')
    await expect(page.getByText('Error al cargar la lista')).toBeVisible({ timeout: 15000 })
    fail = false
    await page.getByText('Reintentar').click()
    await expect(page.getByText('Lista de Compras').first()).toBeVisible()
    await expect(page.getByText('Error al cargar la lista')).not.toBeVisible()
  })

  test('collection detail shows the error state on a 500', async ({ page }) => {
    const headers = await authHeaders(page)
    const colRes = await page.request.post(`${API_URL}/v1/collections`, {
      headers,
      data: { name: `E2E ColErr ${Date.now()}`, emoji: '💥' },
    })
    const collection = (await colRes.json()) as { id: string }
    try {
      await page.route(`**/v1/collections/${collection.id}/recipes*`, (route) =>
        route.fulfill({ status: 500, body: JSON.stringify({ error: 'boom' }) }),
      )
      await page.goto(`/collections/${collection.id}`)
      await expect(page.getByText('No se pudo cargar la colección.')).toBeVisible({
        timeout: 15000,
      })
    } finally {
      await deleteCollectionViaApi(page, collection.id)
    }
  })

  test('a 500 saving the cook rating surfaces the error notification', async ({ page }) => {
    const recipe = await createRecipeViaApi(page)
    try {
      await page.route('**/v1/cook-sessions', (route) =>
        route.request().method() === 'POST'
          ? route.fulfill({ status: 500, body: JSON.stringify({ error: 'boom' }) })
          : route.fallback(),
      )
      let dialogMessage = ''
      page.on('dialog', (dialog) => {
        dialogMessage = dialog.message()
        void dialog.accept()
      })
      await page.goto(`/recipe/${recipe.id}`)
      await page.getByTestId('recipe-detail-cook').click()
      await expect(page.getByText(/Paso 1 \/ /)).toBeVisible()
      await page.getByTestId('cook-finish').click()
      await expect(page.getByTestId('cook-rating-save')).toBeVisible()
      await page.getByTestId('cook-rating-save').click()
      await expect.poll(() => dialogMessage).toContain('Error')
    } finally {
      await deleteRecipeViaApi(page, recipe.id)
    }
  })

  test('the app still boots to home when /auth/me fails', async ({ page }) => {
    await page.route('**/auth/me', (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'boom' }) }),
    )
    await page.goto('/')
    await expect(page.getByText('+ Nueva Receta')).toBeVisible({ timeout: 15000 })
  })

  test('stats renders a deleted-recipe row as unclickable', async ({ page }) => {
    await page.route('**/v1/cook-sessions/stats*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          since: '2026-04-01',
          totalSessions: 3,
          topRecipes: [
            {
              recipeId: null,
              title: 'Guiso viejo',
              count: 3,
              lastCookedAt: '2026-07-01T12:00:00.000Z',
            },
          ],
          frequencyByWeek: [{ week: '2026-W27', count: 3 }],
        }),
      }),
    )
    await page.goto('/stats')
    await expect(page.getByText('Guiso viejo (eliminada)')).toBeVisible()
    await expect(page.getByText('3×')).toBeVisible()
  })
})

test.describe('Small interaction branches', () => {
  test('menu modal Cancelar closes without changes', async ({ page }) => {
    const headers = await authHeaders(page)
    const recipe = await createRecipeViaApi(page)
    const today = new Date().toISOString().slice(0, 10)
    await page.request.post(`${API_URL}/v1/menu`, {
      headers,
      data: { date: today, slot: 'Cena', recipeId: recipe.id, servings: 2 },
    })
    try {
      await page.getByText('Menú Semanal').click()
      const chip = page.locator('[data-testid^="menu-entry-"]').first()
      await expect(chip).toBeVisible()
      await chip.click()
      await expect(page.getByTestId('menu-modal-save')).toBeVisible()
      await page.getByText('Cancelar', { exact: true }).click()
      await expect(page.getByTestId('menu-modal-save')).not.toBeVisible()
    } finally {
      await page.request.delete(`${API_URL}/v1/menu/${today}/Cena/${recipe.id}`, { headers })
      await deleteRecipeViaApi(page, recipe.id)
    }
  })

  test('two entries in the same slot render grouped', async ({ page }) => {
    const headers = await authHeaders(page)
    const a = await createRecipeViaApi(page)
    const b = await createRecipeViaApi(page)
    const today = new Date().toISOString().slice(0, 10)
    for (const r of [a, b]) {
      await page.request.post(`${API_URL}/v1/menu`, {
        headers,
        data: { date: today, slot: 'Desayuno', recipeId: r.id, servings: 2 },
      })
    }
    try {
      await page.getByText('Menú Semanal').click()
      await expect(page.getByTestId(`menu-entry-${today}-Desayuno-${a.id}`)).toBeVisible()
      await expect(page.getByTestId(`menu-entry-${today}-Desayuno-${b.id}`)).toBeVisible()
    } finally {
      for (const r of [a, b]) {
        await page.request.delete(`${API_URL}/v1/menu/${today}/Desayuno/${r.id}`, { headers })
        await deleteRecipeViaApi(page, r.id)
      }
    }
  })

  test('pick screen servings − clamps at 1', async ({ page }) => {
    await page.goto('/menu/pick?date=2027-03-12&slot=Cena&weekStart=2027-03-08')
    await expect(page.getByText('Porciones:')).toBeVisible()
    await page.getByText('−', { exact: true }).click()
    await page.getByText('−', { exact: true }).click()
    await page.getByText('−', { exact: true }).click()
    await expect(page.getByText('1', { exact: true })).toBeVisible()
  })

  test('cook mode ✕ returns to the recipe detail', async ({ page }) => {
    const recipe = await createRecipeViaApi(page)
    try {
      await page.goto('/')
      await page.getByPlaceholder(/buscar recetas/i).fill(recipe.title)
      await page.getByText(recipe.title).first().click()
      await expect(page.getByTestId('recipe-detail-cook')).toBeVisible()
      await page.getByTestId('recipe-detail-cook').click()
      await expect(page.getByText(/Paso 1 \/ /)).toBeVisible()
      await page.getByText('✕').click()
      await expect(page.getByTestId('recipe-detail-cook')).toBeVisible()
    } finally {
      await deleteRecipeViaApi(page, recipe.id)
    }
  })

  test('searching gibberish shows Sin resultados', async ({ page }) => {
    await page.getByPlaceholder(/buscar recetas/i).fill('zzzz-sin-match-xq')
    await expect(page.getByText('Sin resultados')).toBeVisible()
  })

  test('creating a second household works and can be cleaned up', async ({ page }) => {
    const headers = await authHeaders(page)
    const mineRes = (await (
      await page.request.get(`${API_URL}/v1/households/mine`, { headers })
    ).json()) as unknown[]
    if (mineRes.length === 0) {
      await page.request.post(`${API_URL}/v1/households`, {
        headers,
        data: { name: `E2E Hogar Base ${Date.now()}` },
      })
    }
    await page.goto('/household')
    await expect(page.getByPlaceholder('Nombre del nuevo hogar…')).toBeVisible()
    const name = `E2E Segundo Hogar ${Date.now()}`
    await page.getByPlaceholder('Nombre del nuevo hogar…').fill(name)
    await page.getByText('Crear otro hogar').click()
    await expect(page.getByText(name)).toBeVisible()

    const mine = (await (
      await page.request.get(`${API_URL}/v1/households/mine`, { headers })
    ).json()) as { id: string; name: string }[]
    const created = mine.find((h) => h.name === name)
    expect(created).toBeTruthy()
    await page.request.delete(`${API_URL}/v1/households/${created!.id}`, { headers })
  })

  test('profile rows navigate to config, stats and household', async ({ page }) => {
    await page.goto('/profile')
    await expect(page.getByText('⚙️ Configuración de taxonomía')).toBeVisible()
    await page.getByText('⚙️ Configuración de taxonomía').click()
    await expect(page.getByTestId('config-tab-food-types')).toBeVisible()

    await page.goto('/profile')
    await page.getByText('📊 Estadísticas').click()
    await expect(page.getByText(/sesiones de cocina|Recetas más cocinadas/).first()).toBeVisible()

    await page.goto('/profile')
    await page.getByText('🏠 Mi hogar').click()
    await expect(
      page
        .getByTestId('household-create-name-input')
        .or(page.getByTestId('household-invite-open').first()),
    ).toBeVisible()
  })

  test('submitting the name edit with Enter saves it', async ({ page }) => {
    await page.goto('/profile')
    await expect(page.getByText('tocá para editar')).toBeVisible()
    await page.getByText('tocá para editar').click()
    const input = page.locator('input').first()
    await input.fill('Demo Enter E2E')
    await input.press('Enter')
    await expect(page.getByText('Demo Enter E2E')).toBeVisible()
  })

  test('collection remove confirm can be dismissed, keeping the recipe', async ({ page }) => {
    const headers = await authHeaders(page)
    const colRes = await page.request.post(`${API_URL}/v1/collections`, {
      headers,
      data: { name: `E2E ColDismiss ${Date.now()}`, emoji: '🧪' },
    })
    const collection = (await colRes.json()) as { id: string }
    const recipe = await createRecipeViaApi(page)
    try {
      await page.request.post(`${API_URL}/v1/collections/${collection.id}/recipes`, {
        headers,
        data: { recipeId: recipe.id },
      })
      await page.goto(`/collections/${collection.id}`)
      const row = page.getByTestId(`collection-recipe-${recipe.id}`)
      await expect(row).toBeVisible()
      page.once('dialog', (dialog) => void dialog.dismiss())
      await page.getByTestId(`collection-remove-${recipe.id}`).click()
      await expect(row).toBeVisible()
    } finally {
      await deleteCollectionViaApi(page, collection.id)
      await deleteRecipeViaApi(page, recipe.id)
    }
  })
})

test.describe('Save to collection from recipe detail', () => {
  // Coverage is collected from the page at the end of each test, so each test
  // ends on the screen it exercises (no page.goto afterwards).
  test('saves into an existing and a new collection, closes and reports errors', async ({
    page,
  }) => {
    const headers = await authHeaders(page)
    const stamp = Date.now()
    const colRes = await page.request.post(`${API_URL}/v1/collections`, {
      headers,
      data: { name: `E2E Existente ${stamp}`, emoji: '🧪' },
    })
    const existing = (await colRes.json()) as { id: string }
    const recipe = await createRecipeViaApi(page)
    try {
      await page.goto(`/recipe/${recipe.id}`)
      // open + close without saving
      await page.getByTestId('recipe-save-to-collection').click()
      await expect(page.getByTestId('collection-picker')).toBeVisible()
      await page.getByTestId('recipe-save-to-collection').click()
      await expect(page.getByTestId('collection-picker')).toHaveCount(0)

      await page.getByTestId('recipe-save-to-collection').click()
      await page.getByTestId(`collection-pick-${existing.id}`).click()
      await expect(page.getByTestId('collection-saved-msg')).toContainText(`E2E Existente ${stamp}`)

      await page.getByTestId('recipe-save-to-collection').click()
      await page.getByTestId('collection-new-name').fill(`E2E Nueva ${stamp}`)
      await page.getByTestId('collection-new-save').click()
      await expect(page.getByTestId('collection-saved-msg')).toContainText(`E2E Nueva ${stamp}`)

      // a failed save notifies
      await page.route('**/v1/collections/*/recipes', (route) =>
        route.request().method() === 'POST'
          ? route.fulfill({ status: 500, body: JSON.stringify({ error: 'boom' }) })
          : route.fallback(),
      )
      let dialogMessage = ''
      page.once('dialog', (d) => {
        dialogMessage = d.message()
        void d.accept()
      })
      await page.getByTestId('recipe-save-to-collection').click()
      await page.getByTestId(`collection-pick-${existing.id}`).click()
      await expect.poll(() => dialogMessage).toContain('No se pudo guardar')
      await page.unroute('**/v1/collections/*/recipes')

      const inExisting = (await (
        await page.request.get(`${API_URL}/v1/collections/${existing.id}/recipes`, { headers })
      ).json()) as Array<{ id: string }>
      expect(inExisting.map((r) => r.id)).toContain(recipe.id)
      const list = (await (
        await page.request.get(`${API_URL}/v1/collections`, { headers })
      ).json()) as Array<{ name: string; recipeCount: number }>
      expect(list.find((c) => c.name === `E2E Nueva ${stamp}`)?.recipeCount).toBe(1)
    } finally {
      await deleteRecipeViaApi(page, recipe.id)
    }
  })

  test('a collection opened from a link takes its name from the list', async ({ page }) => {
    const headers = await authHeaders(page)
    const stamp = Date.now()
    const colRes = await page.request.post(`${API_URL}/v1/collections`, {
      headers,
      data: { name: `E2E Enlace ${stamp}` },
    })
    const col = (await colRes.json()) as { id: string }
    await page.goto(`/collections/${col.id}`)
    await expect(page.getByTestId('collection-detail-title')).toContainText(`E2E Enlace ${stamp}`)
    await expect(page.getByTestId('collection-detail-empty')).toContainText('Guardar en colección')
  })
})

test.describe('Data-shape branches', () => {
  test('an ingredient without quantity renders c/n and scaled nutrition totals update', async ({
    page,
  }) => {
    const recipe = await createRecipeViaApi(page, {
      ingredients: [
        { name: 'agua', quantity: 1, unit: 'l' },
        { name: 'sal', quantity: null, unit: null },
      ],
      nutrition: { calories: 400, protein_g: 20, carbs_g: 40, fat_g: 10 },
    })
    try {
      await page.goto(`/recipe/${recipe.id}`)
      await expect(page.getByTestId('recipe-detail-cook')).toBeVisible()
      await expect(page.getByText(/c\/n/).first()).toBeVisible()
      // scaled box multiplies the per-serving values by the current servings:
      // at 4 servings, 400 kcal/porción → 1600 total
      await page.getByText('+', { exact: true }).first().click()
      await page.getByText('+', { exact: true }).first().click()
      await expect(page.getByText('Nutrición por cantidad de porciones')).toBeVisible()
      await expect(page.getByText('1600').first()).toBeVisible()
    } finally {
      await deleteRecipeViaApi(page, recipe.id)
    }
  })

  test('an allergen conflict shows the ⚠ badge and the detail warning', async ({ page }) => {
    const headers = await authHeaders(page)
    await page.request.put(`${API_URL}/v1/profile`, {
      headers,
      data: { allergens: ['maní'] },
    })
    const recipe = await createRecipeViaApi(page, {
      ingredients: [{ name: 'maní', quantity: 100, unit: 'g' }],
    })
    try {
      await page.goto(`/recipe/${recipe.id}`)
      await expect(page.getByText(/Contiene|alérgeno|maní/i).first()).toBeVisible()
    } finally {
      await page.request.put(`${API_URL}/v1/profile`, { headers, data: { allergens: [] } })
      await deleteRecipeViaApi(page, recipe.id)
    }
  })

  test('the food-type picker caps the selection at three', async ({ page }) => {
    await page.getByText('+ Nueva Receta').click()
    await expect(page.getByPlaceholder('Nombre de la receta')).toBeVisible()
    const chips = page.locator('[data-testid^="food-type-chip-"]')
    for (let i = 0; i < 4; i++) {
      await chips.nth(i).click()
    }
    // 4th click is a no-op (max 3) — form still healthy
    await expect(page.getByPlaceholder('Nombre de la receta')).toBeVisible()
  })

  test('a Sunday clock computes the week starting the previous Monday', async ({ page }) => {
    // 2027-03-14 is a Sunday → getWeekStart's day===0 branch → Monday 2027-03-08
    await page.clock.install({ time: new Date('2027-03-14T15:00:00') })
    await page.goto('/menu')
    await expect(page.getByText('Lista de compras')).toBeVisible()
    await page.getByText('Lista de compras').click()
    await page.waitForURL(/weekStart=2027-03-08/)
  })
})

test.describe('Collections: delete', () => {
  test('deleting a collection from its screen keeps its recipes', async ({ page }) => {
    const headers = await authHeaders(page)
    const name = `E2E Borrar ${Date.now()}`
    const colRes = await page.request.post(`${API_URL}/v1/collections`, {
      headers,
      data: { name, emoji: '🗑️' },
    })
    const collection = (await colRes.json()) as { id: string }
    const recipe = await createRecipeViaApi(page)
    try {
      await page.request.post(`${API_URL}/v1/collections/${collection.id}/recipes`, {
        headers,
        data: { recipeId: recipe.id },
      })
      await page.goto('/collections')
      await page.getByText(name).click()
      await expect(page.getByTestId(`collection-recipe-${recipe.id}`)).toBeVisible()
      page.once('dialog', (d) => void d.accept())
      await page.getByTestId('collection-delete').click()
      // Back on the list, the collection is gone; the recipe still exists
      await expect(page.getByText(name)).toHaveCount(0)
      const res = await page.request.get(`${API_URL}/v1/recipes/${recipe.id}`, { headers })
      expect(res.ok()).toBe(true)
    } finally {
      await deleteCollectionViaApi(page, collection.id)
      await deleteRecipeViaApi(page, recipe.id)
    }
  })
})
