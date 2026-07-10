import { test, expect } from './fixtures'

/**
 * Role-aware UI (sharing epic story 6): a household viewer sees the shared
 * content but no mutation affordances. Creates a real viewer user, invites it
 * into a household owned by this worker's demo account, logs in AS the viewer
 * inside the test, and cleans everything up afterwards.
 */

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000'

test('a household viewer sees shared content without mutation affordances', async ({
  page,
}, testInfo) => {
  const ownerHeaders = {
    Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('auth_token'))}`,
    'Content-Type': 'application/json',
  }

  // Owner needs a household to invite into
  const mine = (await (
    await page.request.get(`${API_URL}/v1/households/mine`, { headers: ownerHeaders })
  ).json()) as { id: string }[]
  let householdId = mine[0]?.id
  if (!householdId) {
    const hh = await page.request.post(`${API_URL}/v1/households`, {
      headers: ownerHeaders,
      data: { name: `E2E Hogar Viewer ${Date.now()}` },
    })
    householdId = ((await hh.json()) as { id: string }).id
  }

  // A recipe of the owner the viewer will be able to read
  const recipeRes = await page.request.post(`${API_URL}/v1/recipes`, {
    headers: ownerHeaders,
    data: {
      title: `E2E Del Hogar ${testInfo.parallelIndex} ${Date.now()}`,
      servings: 2,
      category: 'Cena',
      ingredients: [{ name: 'sal', quantity: 1, unit: 'g' }],
      steps: [{ text: 'Único.' }],
    },
  })
  const recipe = (await recipeRes.json()) as { id: string; title: string }

  // Fresh viewer user, invited with role=viewer
  const viewerEmail = `viewer-e2e-${testInfo.parallelIndex}-${Date.now()}@example.com`
  const regRes = await page.request.post(`${API_URL}/auth/register`, {
    data: { email: viewerEmail, password: 'password123' },
  })
  const viewer = (await regRes.json()) as { token: string; user: { id: string } }
  const inviteRes = await page.request.post(`${API_URL}/v1/households/${householdId}/invite`, {
    headers: ownerHeaders,
    data: { userId: viewer.user.id, role: 'viewer' },
  })
  expect(inviteRes.status()).toBe(201)

  try {
    // Become the viewer in the browser
    await page.evaluate((jwt) => localStorage.setItem('auth_token', jwt), viewer.token)
    await page.goto('/')
    await page.waitForLoadState('networkidle', { timeout: 15000 })

    // Shared recipe is visible…
    await page.getByPlaceholder(/buscar recetas/i).fill(recipe.title)
    await page.getByText(recipe.title).first().click()
    await expect(page.getByTestId('recipe-detail-cook')).toBeVisible({ timeout: 10000 })
    // …but a housemate's recipe offers no Editar
    await expect(page.getByText('Editar')).not.toBeVisible()

    // The shared menu shows no mutation affordances for viewers
    await page.goto('/menu')
    await expect(page.getByText('Lista de compras')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('[data-testid^="menu-add-"]')).toHaveCount(0)
    await expect(page.locator('[data-testid^="menu-remove-"]')).toHaveCount(0)

    // Recipes stay personal: the create FAB remains available
    await page.goto('/')
    await expect(page.getByText('+ Nueva Receta')).toBeVisible({ timeout: 10000 })
  } finally {
    await page.request.delete(`${API_URL}/v1/households/${householdId}/members/${viewer.user.id}`, {
      headers: ownerHeaders,
    })
    await page.request.delete(`${API_URL}/v1/recipes/${recipe.id}`, { headers: ownerHeaders })
  }
})
