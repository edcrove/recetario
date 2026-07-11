import { test, expect } from './fixtures'

// Ingredient unification story 4: the config "Ingredientes" tab lists canonicals
// grouped by family with synonyms as chips, search, and two curation actions
// (create a canonical, move a synonym). These smokes drive the real UI.
const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000'

test('lists canonicals, creates one, and searches', async ({ page }) => {
  const token = await page.evaluate(() => localStorage.getItem('auth_token'))
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  // Unique prefix keeps this test isolated from the parallel move test (canonicals
  // are global, so a shared search prefix would let the tests see each other's rows).
  const prefix = `Kcreate${Math.random().toString(36).slice(2, 8)}`
  const name = `${prefix} kale`

  try {
    await page.goto('/config')
    await page.getByTestId('config-tab-ingredients').click()
    await expect(page.getByTestId('ingredients-search')).toBeVisible({ timeout: 10000 })

    // Create
    await page.getByTestId('ingredients-new-name').fill(name)
    await page.getByTestId('ingredients-new-create').click()
    await expect(page.getByText(name)).toBeVisible({ timeout: 10000 })

    // Search filters down to the new canonical…
    await page.getByTestId('ingredients-search').fill(prefix)
    await expect(page.getByText(name)).toBeVisible()
    // …and a nonsense query yields nothing.
    await page.getByTestId('ingredients-search').fill('zzzznomatchxyz')
    await expect(page.getByText('Sin resultados.')).toBeVisible()
  } finally {
    const list = (await (
      await page.request.get(`${API_URL}/v1/ingredients`, { headers })
    ).json()) as { id: string; name: string }[]
    const created = list.find((c) => c.name === name)
    if (created) {
      await page.request.delete(`${API_URL}/v1/ingredients/canonical/${created.id}`, { headers })
    }
  }
})

test('moves a synonym from one canonical to another', async ({ page }) => {
  const token = await page.evaluate(() => localStorage.getItem('auth_token'))
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  // Unique prefix isolates this test from the parallel create/search test.
  const prefix = `Kmove${Math.random().toString(36).slice(2, 8)}`
  const nameA = `${prefix} A`
  const nameB = `${prefix} B`
  const syn = `zzsyn${prefix}`.toLowerCase() // synonyms are stored normalized (lowercase)
  const created: string[] = []

  try {
    // Isolated fixtures: two canonicals + a synonym on A.
    const post = async (path: string, body: object) =>
      (await page.request.post(`${API_URL}${path}`, { headers, data: body })).json()
    const a = (await post('/v1/ingredients/canonical', { name: nameA })) as { id: string }
    const b = (await post('/v1/ingredients/canonical', { name: nameB })) as { id: string }
    created.push(a.id, b.id)
    await post('/v1/ingredients/synonym', { surface: syn, canonicalId: a.id })

    await page.goto('/config')
    await page.getByTestId('config-tab-ingredients').click()
    await page.getByTestId('ingredients-search').fill(prefix)

    // Pick the synonym chip → banner shows; cancel first to exercise that path.
    await page.getByText(syn).click()
    await expect(page.getByTestId('ingredients-moving-banner')).toBeVisible()
    await page.getByTestId('ingredients-move-cancel').click()
    await expect(page.getByTestId('ingredients-moving-banner')).toBeHidden()

    // Pick it again and move it onto canonical B.
    await page.getByText(syn).click()
    await page.getByTestId(`ingredients-move-here-${b.id}`).click()

    // The synonym now lives under B — verify via the API.
    await expect(async () => {
      const list = (await (
        await page.request.get(`${API_URL}/v1/ingredients`, { headers })
      ).json()) as { id: string; synonyms: { synonym: string }[] }[]
      const bRow = list.find((c) => c.id === b.id)
      expect(bRow?.synonyms.some((s) => s.synonym === syn)).toBe(true)
    }).toPass({ timeout: 10000 })
  } finally {
    for (const id of created) {
      await page.request.delete(`${API_URL}/v1/ingredients/canonical/${id}`, { headers })
    }
  }
})
