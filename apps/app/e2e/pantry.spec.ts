import { test, expect } from './fixtures'

// Pantry epic story 3: the Despensa screen — reachable from the user menu — lets
// you add items, toggle stock, and remove them. Items are owner-scoped, so the
// per-worker demo accounts don't collide.
const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000'

test('add, toggle and delete a pantry item from the Despensa screen', async ({ page }) => {
  const token = await page.evaluate(() => localStorage.getItem('auth_token'))
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const name = `ZzPantry${Math.random().toString(36).slice(2, 8)}`

  // Seed items with expiry dates so the screen exercises every badge state.
  const iso = (offsetDays: number) => {
    const d = new Date()
    d.setDate(d.getDate() + offsetDays)
    return d.toISOString().slice(0, 10)
  }
  const dated: string[] = []
  for (const [suffix, offset] of [
    ['past', -2],
    ['soon', 2],
    ['far', 30],
  ] as const) {
    const res = await page.request.post(`${API_URL}/v1/pantry`, {
      headers,
      data: { name: `${name}${suffix}`, expiryDate: iso(offset), inStock: true },
    })
    dated.push(((await res.json()) as { id: string }).id)
  }

  try {
    // Reach the screen through the user menu (entry point).
    await page.goto('/')
    await page.getByTestId('home-profile-button').click()
    await page.getByText('Despensa').click()
    await expect(page.getByTestId('pantry-new-name')).toBeVisible({ timeout: 10000 })

    // Expiry badges render for the seeded dated items.
    await expect(page.getByTestId(`pantry-expiry-${dated[0]}`)).toHaveText('Vencido')
    await expect(page.getByTestId(`pantry-expiry-${dated[1]}`)).toHaveText('Vence pronto')
    await expect(page.getByTestId(`pantry-expiry-${dated[2]}`)).toContainText('Vence')

    // Add
    await page.getByTestId('pantry-new-name').fill(name)
    await page.getByTestId('pantry-add').click()
    await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 10000 })

    // Toggle out of stock — it moves to "Se acabó"
    const list = (await (await page.request.get(`${API_URL}/v1/pantry`, { headers })).json()) as {
      id: string
      name: string
    }[]
    const created = list.find((i) => i.name === name)!
    await page.getByTestId(`pantry-toggle-${created.id}`).click()
    await expect(page.getByText('Se acabó')).toBeVisible({ timeout: 10000 })

    // Delete
    await page.getByTestId(`pantry-delete-${created.id}`).click()
    await expect(page.getByText(name, { exact: true })).toBeHidden({ timeout: 10000 })

    // Back link returns to the previous screen.
    await page.getByText('‹ Volver').click()
    await expect(page.getByTestId('pantry-new-name')).toBeHidden({ timeout: 10000 })
  } finally {
    const list = (await (await page.request.get(`${API_URL}/v1/pantry`, { headers })).json()) as {
      id: string
      name: string
    }[]
    for (const leftover of list.filter((i) => i.name.startsWith(name))) {
      await page.request.delete(`${API_URL}/v1/pantry/${leftover.id}`, { headers })
    }
  }
})

test('shows the error state and recovers with Reintentar', async ({ page }) => {
  // Fail the pantry load, then let the retry succeed.
  let fail = true
  await page.route('**/v1/pantry', (route) => {
    if (fail && route.request().method() === 'GET')
      return route.fulfill({ status: 500, body: '{}' })
    return route.continue()
  })
  await page.goto('/pantry')
  await expect(page.getByText('Error al cargar la despensa')).toBeVisible({ timeout: 10000 })
  fail = false
  await page.getByText('Reintentar').click()
  await expect(page.getByTestId('pantry-new-name')).toBeVisible({ timeout: 10000 })
  await page.unroute('**/v1/pantry')
})
