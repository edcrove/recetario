import { test, testUnauth, expect } from './fixtures'

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000'

async function authHeaders(page: import('@playwright/test').Page) {
  const token = await page.evaluate(() => localStorage.getItem('auth_token'))
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

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
  await expect(page.getByTestId('recipe-delete')).toBeVisible({ timeout: 10000 })

  page.once('dialog', (d) => void d.dismiss())
  await page.getByTestId('recipe-delete').click()
  await expect(page.getByTestId('recipe-delete')).toBeVisible()

  page.once('dialog', (d) => void d.accept())
  await page.getByTestId('recipe-delete').click()
  await expect(page.getByPlaceholder(/buscar recetas/i)).toBeVisible({ timeout: 10000 })
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
  await expect(page.getByTestId('menu-week-label')).toBeVisible({ timeout: 10000 })
})

test('"Todas" clears the time and difficulty filters too', async ({ page }) => {
  await expect(page.getByText('Milanesa de pollo').first()).toBeVisible({ timeout: 10000 })
  await page.getByTestId('filter-time-20').click()
  await expect(page.getByText('Milanesa de pollo')).toHaveCount(0, { timeout: 8000 })
  await page.getByTestId('home-type-chip-all').click()
  await expect(page.getByText('Milanesa de pollo').first()).toBeVisible({ timeout: 8000 })
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
  ).toBeVisible({
    timeout: 8000,
  })
})
