import { test, testUnauth, expect } from './fixtures'
import { API_URL } from './env'
import { authHeaders } from './api'

test('a recipe can be deleted from its detail screen after confirming', async ({ page }) => {
  const headers = await authHeaders(page)
  const res = await page.request.post(`${API_URL}/v1/recipes`, {
    headers,
    data: {
      title: `E2E Borrar ${Date.now()}`,
      servings: 2,
      category: 'Cena',
      ingredients: [{ name: 'sal', quantity: 1, unit: 'g' }],
    },
  })
  const { id } = (await res.json()) as { id: string }
  await page.goto(`/recipe/${id}`)
  await expect(page.getByTestId('recipe-delete')).toBeVisible()

  page.once('dialog', (d) => void d.dismiss())
  await page.getByTestId('recipe-delete').click()
  await expect(page.getByTestId('recipe-delete')).toBeVisible()

  page.once('dialog', (d) => void d.accept())
  await page.getByTestId('recipe-delete').click()
  await expect(page.getByPlaceholder(/buscar recetas/i)).toBeVisible()
  expect((await page.request.get(`${API_URL}/v1/recipes/${id}`, { headers })).status()).toBe(404)
})

test('a failed load offers Reintentar, which recovers', async ({ page }) => {
  // Fail (including react-query's own retry) until the user taps Reintentar
  let failing = true
  await page.route('**/v1/menu?*', (route) =>
    failing
      ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
      : route.fallback(),
  )
  await page.goto('/menu')
  await expect(page.getByTestId('error-retry')).toBeVisible({ timeout: 15000 })
  failing = false
  await page.getByTestId('error-retry').click()
  await expect(page.getByTestId('menu-week-label')).toBeVisible()
})

test('"Todas" clears the time and difficulty filters too', async ({ page }) => {
  await expect(page.getByText('Milanesa de pollo').first()).toBeVisible()
  await page.getByTestId('filter-time-20').click()
  await expect(page.getByText('Milanesa de pollo')).toHaveCount(0)
  await page.getByTestId('home-type-chip-all').click()
  await expect(page.getByText('Milanesa de pollo').first()).toBeVisible()
})

testUnauth('too many login attempts get a readable message', async ({ page }) => {
  await page.route(`${API_URL}/auth/login`, (route) =>
    route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: '{"error":"Too many attempts, try again in a minute"}',
    }),
  )
  await page.goto('/auth/login')
  await page.getByPlaceholder(/email/i).fill('a@b.c')
  await page.getByPlaceholder(/contraseña/i).fill('whatever1')
  await page.getByText('Ingresar', { exact: true }).last().click()
  await expect(
    page.getByText('Demasiados intentos. Esperá un minuto y probá de nuevo.'),
  ).toBeVisible()
})

// 2026-10-02 review: these screens showed a failed load as their empty state —
// "0 sesiones", "La biblioteca está vacía", "Sin colecciones", the form to
// create a household, and the profile with default targets that a tap on a
// stepper would then save over the real ones.
for (const [path, api, message, emptyText] of [
  [
    '/stats',
    '**/v1/cook-sessions/stats*',
    'No se pudieron cargar las estadísticas.',
    'sesiones de cocina',
  ],
  ['/library', '**/v1/library*', 'No se pudo cargar la biblioteca.', 'La biblioteca está vacía'],
  [
    '/collections',
    '**/v1/collections',
    'No se pudieron cargar las colecciones.',
    'Sin colecciones',
  ],
  ['/household', '**/v1/households/mine', 'No se pudo cargar tu hogar.', 'Crear hogar'],
  ['/profile', '**/auth/profile', 'No se pudo cargar tu perfil.', 'Calorías'],
] as const) {
  test(`${path}: a failed load says so instead of showing the empty screen`, async ({ page }) => {
    let failing = true
    await page.route(api, (route) =>
      failing && route.request().method() === 'GET'
        ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
        : route.fallback(),
    )
    await page.goto(path)
    await expect(page.getByText(message)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(emptyText, { exact: false })).toHaveCount(0)
    failing = false
    await page.getByTestId('error-retry').click()
    await expect(page.getByText(message)).toHaveCount(0)
  })
}

// 2026-10-02 review: the delete confirmation says the recipe also leaves the
// menu, but its upcoming dishes stayed as unremovable "(eliminada)" chips.
test('deleting a planned recipe takes its upcoming dishes off the planner', async ({ page }) => {
  const headers = await authHeaders(page)
  const d = new Date()
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const title = `E2E Planificada ${Date.now()}`
  const { id } = (await (
    await page.request.post(`${API_URL}/v1/recipes`, {
      headers,
      data: {
        title,
        servings: 2,
        category: 'Cena',
        ingredients: [{ name: 'sal', quantity: 1, unit: 'g' }],
      },
    })
  ).json()) as { id: string }
  await page.request.post(`${API_URL}/v1/menu`, {
    headers,
    data: { date: today, slot: 'Cena', recipeId: id, servings: 2 },
  })
  try {
    await page.goto(`/recipe/${id}`)
    page.once('dialog', (dlg) => {
      expect(dlg.message()).toContain('También se quita de los próximos menús')
      void dlg.accept()
    })
    await page.getByTestId('recipe-delete').click()
    await expect(page.getByPlaceholder(/buscar recetas/i)).toBeVisible()
    await page.goto('/menu')
    await expect(page.getByTestId(`menu-day-${today}`)).toBeVisible()
    await expect(page.getByText(`${title} (eliminada)`)).toHaveCount(0)
    await expect(page.getByText(title)).toHaveCount(0)
  } finally {
    await page.request.delete(`${API_URL}/v1/menu/${today}/Cena/${id}`, { headers })
    await page.request.delete(`${API_URL}/v1/recipes/${id}`, { headers })
  }
})

// 2026-10-02 review: a failed history load read "Todavía no cocinaste esta receta"
test("a recipe's history says when it could not load, and retries", async ({ page }) => {
  const headers = await authHeaders(page)
  const { id } = (await (
    await page.request.post(`${API_URL}/v1/recipes`, {
      headers,
      data: {
        title: `E2E Historial ${Date.now()}`,
        servings: 2,
        category: 'Cena',
        ingredients: [{ name: 'sal', quantity: 1, unit: 'g' }],
      },
    })
  ).json()) as { id: string }
  let failing = true
  await page.route('**/v1/cook-sessions?*', (route) =>
    failing
      ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
      : route.fallback(),
  )
  try {
    await page.goto(`/recipe/${id}`)
    await page.getByTestId('recipe-tab-history').click()
    await expect(page.getByText(/No se pudo cargar el historial/)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Todavía no cocinaste esta receta.')).toHaveCount(0)
    failing = false
    await page.getByTestId('history-retry').click()
    await expect(page.getByText('Todavía no cocinaste esta receta.')).toBeVisible()
  } finally {
    await page.request.delete(`${API_URL}/v1/recipes/${id}`, { headers })
  }
})

// 2026-10-02 review: cook mode showed a failed load as "Esta receta no tiene pasos."
test('cook mode says when the recipe could not load', async ({ page }) => {
  await page.route('**/v1/recipes/*', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
      : route.fallback(),
  )
  await page.goto('/recipe/550e8400-e29b-41d4-a716-446655440000/cook')
  await expect(page.getByText('No se pudo cargar la receta.')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('Esta receta no tiene pasos.')).toHaveCount(0)
})
