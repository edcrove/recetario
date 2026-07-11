import { test, expect } from './fixtures'

// Recipe provenance (import epic story 1): a recipe with a source URL shows a
// "Fuente: {host}" link on its detail. The MCP fetch tool + createRecipe set
// source; here we assert the display end via a recipe created with a source.
const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000'

test('a recipe with a source URL shows its provenance on the detail', async ({ page }) => {
  const token = await page.evaluate(() => localStorage.getItem('auth_token'))
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const res = await page.request.post(`${API_URL}/v1/recipes`, {
    headers,
    data: {
      title: `E2E Importada ${Date.now()}`,
      servings: 2,
      category: 'Cena',
      ingredients: [{ name: 'sal', quantity: 1, unit: 'g' }],
      steps: [{ text: 'Único.' }],
      source: { type: 'url', url: 'https://www.cookpad.com/receta/123' },
    },
  })
  expect(res.ok()).toBe(true)
  const recipe = (await res.json()) as { id: string }
  try {
    await page.goto(`/recipe/${recipe.id}`)
    await expect(page.getByTestId('recipe-source')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Fuente: cookpad.com')).toBeVisible()
  } finally {
    await page.request.delete(`${API_URL}/v1/recipes/${recipe.id}`, { headers })
  }
})
