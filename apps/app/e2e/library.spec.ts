import { test, expect } from './fixtures'

/**
 * Public library E2E flows (sharing epic story 5).
 * Every recipe created here is cleaned up via API.
 */

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000'

async function authHeaders(page: import('@playwright/test').Page) {
  const token = await page.evaluate(() => localStorage.getItem('auth_token'))
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

test.describe('Biblioteca', () => {
  test('smoke: opens from the user menu and shows the search box', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await page.getByText('Biblioteca').click()
    await expect(page.getByTestId('library-search')).toBeVisible({ timeout: 8000 })
  })

  test('publish → appears in library → copy → fork is independent', async ({ page }) => {
    const headers = await authHeaders(page)
    const title = `E2E Publicable ${Date.now()}`
    const createRes = await page.request.post(`${API_URL}/v1/recipes`, {
      headers,
      data: {
        title,
        servings: 2,
        category: 'Cena',
        notes: 'Original intacta',
        ingredients: [{ name: 'agua', quantity: 1, unit: 'l' }],
        steps: [{ text: 'Hervir.' }],
      },
    })
    expect(createRes.ok()).toBe(true)
    const original = (await createRes.json()) as { id: string }
    let forkId: string | undefined

    // Accept every dialog: publish confirm, copy confirm, success notify
    page.on('dialog', (dialog) => void dialog.accept())

    try {
      // 1. Publish via the edit form toggle
      await page.goto(`/recipe/${original.id}/edit`)
      await expect(page.getByTestId('visibility-toggle')).toBeVisible({ timeout: 10000 })
      await expect(page.getByText('🔒 Privada')).toBeVisible()
      await page.getByTestId('visibility-toggle').click()
      await expect(page.getByText('🌐 Pública')).toBeVisible({ timeout: 5000 })
      await page.getByText('Guardar Cambios').click()
      // onSuccess runs router.back(), which no-ops when the edit form was
      // entered via direct URL — the reliable signal is the persisted state
      await expect
        .poll(
          async () => {
            const r = await page.request.get(`${API_URL}/v1/recipes/${original.id}`, { headers })
            return ((await r.json()) as { visibility?: string }).visibility
          },
          { timeout: 10000 },
        )
        .toBe('public')

      // 2. It shows in the library with the copy button
      await page.goto('/library')
      await page.getByTestId('library-search').fill(title)
      const copyBtn = page.getByTestId(`library-copy-${original.id}`)
      await expect(copyBtn).toBeVisible({ timeout: 10000 })

      // 3. Copy → lands on the fork's detail with the provenance chip
      await copyBtn.click()
      await expect(page.getByTestId('fork-provenance')).toBeVisible({ timeout: 10000 })
      await expect(page.getByText(new RegExp(`Copiada de ${title.slice(0, 14)}`))).toBeVisible()

      const url = page.url()
      forkId = url.split('/recipe/')[1]
      expect(forkId).toBeTruthy()
      expect(forkId).not.toBe(original.id)

      // 4. Edit the fork — the original never changes
      const editRes = await page.request.put(`${API_URL}/v1/recipes/${forkId}`, {
        headers,
        data: { title: `${title} (mi versión)`, notes: 'Cambiada' },
      })
      expect(editRes.ok()).toBe(true)

      const origRes = await page.request.get(`${API_URL}/v1/recipes/${original.id}`, { headers })
      const origBody = (await origRes.json()) as { title: string; notes: string }
      expect(origBody.title).toBe(title)
      expect(origBody.notes).toBe('Original intacta')
    } finally {
      await page.request.delete(`${API_URL}/v1/recipes/${original.id}`, { headers })
      if (forkId) await page.request.delete(`${API_URL}/v1/recipes/${forkId}`, { headers })
    }
  })

  test('searching for something nonexistent shows the empty state', async ({ page }) => {
    await page.goto('/library')
    await expect(page.getByTestId('library-search')).toBeVisible({ timeout: 8000 })
    await page.getByTestId('library-search').fill('zzz-inexistente-xq')
    await expect(page.getByText('Sin resultados en la biblioteca')).toBeVisible({ timeout: 8000 })
  })

  test('a 500 while copying surfaces the error notification', async ({ page }) => {
    const headers = await authHeaders(page)
    const title = `E2E CopiaFalla ${Date.now()}`
    const createRes = await page.request.post(`${API_URL}/v1/recipes`, {
      headers,
      data: {
        title,
        servings: 2,
        category: 'Cena',
        ingredients: [{ name: 'sal', quantity: 1, unit: 'g' }],
        steps: [{ text: 'Único.' }],
        visibility: 'public',
      },
    })
    const recipe = (await createRes.json()) as { id: string }

    await page.route(`**/v1/recipes/${recipe.id}/copy`, (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'boom' }) }),
    )
    const dialogs: string[] = []
    page.on('dialog', (dialog) => {
      dialogs.push(dialog.message())
      void dialog.accept()
    })

    try {
      await page.goto('/library')
      await page.getByTestId('library-search').fill(title)
      const copyBtn = page.getByTestId(`library-copy-${recipe.id}`)
      await expect(copyBtn).toBeVisible({ timeout: 10000 })
      await copyBtn.click()
      await expect
        .poll(() => dialogs.some((d) => d.includes('No se pudo copiar')), { timeout: 8000 })
        .toBe(true)
    } finally {
      await page.request.delete(`${API_URL}/v1/recipes/${recipe.id}`, { headers })
    }
  })

  test('a new recipe can be born public from the create form', async ({ page }) => {
    const headers = await authHeaders(page)
    const title = `E2E Nace Pública ${Date.now()}`
    page.on('dialog', (dialog) => void dialog.accept())

    await page.getByText('+ Nueva Receta').click()
    await expect(page.getByPlaceholder('Nombre de la receta')).toBeVisible({ timeout: 10000 })
    await page.getByPlaceholder('Nombre de la receta').fill(title)
    await page.getByPlaceholder('Ingrediente').first().fill('sal')
    await page.getByTestId('visibility-toggle').click()
    await expect(page.getByText('🌐 Pública')).toBeVisible({ timeout: 5000 })
    await page.getByText('Guardar Receta').click()
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 })

    let recipeId: string | undefined
    try {
      const listRes = await page.request.get(`${API_URL}/v1/library?search=nace`, { headers })
      const list = (await listRes.json()) as { id: string; title: string }[]
      const found = list.find((r) => r.title === title)
      expect(found).toBeTruthy()
      recipeId = found!.id
    } finally {
      if (recipeId) await page.request.delete(`${API_URL}/v1/recipes/${recipeId}`, { headers })
    }
  })
})
