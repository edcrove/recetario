import { test, expect } from './fixtures'
import { DEMO_ACCOUNTS } from './demoAccounts'

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000'

/**
 * Shared family device: user A signs out and user B signs in on the same page,
 * well inside the 30s query staleTime. B must see none of A's cached data.
 * Navigation stays in-app (no page.goto) so the in-memory cache survives.
 */
test('the next user on the device sees none of the previous user cached data', async ({
  page,
}, testInfo) => {
  const accountA = DEMO_ACCOUNTS[testInfo.parallelIndex]!
  const tokenA = await page.evaluate(() => localStorage.getItem('auth_token'))

  // A's private recipe, loaded into A's cache
  const res = await page.request.post(`${API_URL}/v1/recipes`, {
    headers: { Authorization: `Bearer ${tokenA ?? ''}`, 'Content-Type': 'application/json' },
    data: {
      title: `E2E Privada de A ${Date.now()}`,
      servings: 2,
      category: 'Cena',
      ingredients: [{ name: 'sal', quantity: 1, unit: 'g' }],
      steps: [{ text: 'Único paso.' }],
    },
  })
  const recipe = (await res.json()) as { id: string }
  await page.reload()
  await expect(page.getByTestId(`recipe-card-${recipe.id}`)).toBeVisible({ timeout: 15000 })
  // The user menu shows the signed-in account (cached ['me'] query)
  await page.getByTestId('home-profile-button').click()
  await expect(page.getByText(accountA.email)).toBeVisible({ timeout: 10000 })

  // B: a fresh account with no recipes
  const emailB = `e2e-switch+${Date.now()}-${testInfo.parallelIndex}@recetario.app`
  const reg = await page.request.post(`${API_URL}/auth/register`, {
    data: { email: emailB, password: 'switch1234' },
  })
  expect(reg.status()).toBe(201)

  // A signs out from the user menu, B signs in through the form on the same page
  await page.getByTestId('usermenu-signout').click()
  await expect(page).toHaveURL(/auth\/login/, { timeout: 10000 })
  await page.getByPlaceholder('Email').fill(emailB)
  await page.getByPlaceholder('Contraseña').fill('switch1234')
  await page.getByTestId('auth-login-submit').click()
  await expect(page.getByText('+ Nueva Receta')).toBeVisible({ timeout: 15000 })
  await page.waitForLoadState('networkidle', { timeout: 15000 })

  await expect(page.getByTestId(`recipe-card-${recipe.id}`)).toHaveCount(0)
  await page.getByTestId('home-profile-button').click()
  await expect(page.getByText(emailB)).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(accountA.email)).toHaveCount(0)
})
