import { test, expect } from './fixtures'

/**
 * Smoke E2E: verifies the Expo web app renders and navigates correctly.
 * Requires the app to be running at PLAYWRIGHT_BASE_URL (default localhost:8080).
 * Requires the API at EXPO_PUBLIC_API_URL with demo@recetario.app / demo1234.
 */

test.describe('Smoke: home screen', () => {
  test('home loads with recipe list', async ({ page }) => {
    await expect(page.getByText('Recetario').first()).toBeVisible({ timeout: 10000 })
  })

  test('search input is present', async ({ page }) => {
    await expect(page.getByPlaceholder(/buscar recetas/i)).toBeVisible()
  })

  test('nueva receta button is present', async ({ page }) => {
    await expect(page.getByText('+ Nueva Receta')).toBeVisible()
  })

  test('filter chips are visible', async ({ page }) => {
    await expect(page.getByText('Todas')).toBeVisible()
  })
})

test.describe('Smoke: auth flow', () => {
  test('unauthenticated user is redirected to login', async ({ page: _loggedInPage, browser }) => {
    // Open a fresh context with no auth
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await page.goto('/')
    await expect(page).toHaveURL(/auth\/login/, { timeout: 10000 })
    await ctx.close()
  })

  test('login screen has email and password fields', async ({ page: _loggedInPage, browser }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await page.goto('/auth/login')
    await expect(page.getByPlaceholder('Email')).toBeVisible()
    await expect(page.getByPlaceholder('Contraseña')).toBeVisible()
    await expect(page.getByText('Ingresar')).toBeVisible()
    await ctx.close()
  })
})

test.describe('Smoke: recipe navigation', () => {
  test('clicking a recipe navigates to detail', async ({ page }) => {
    const firstCard = page
      .locator('text=/Milanesa|Pasta|Ensalada|Guiso|Locro|Alfajores|Revuelto|Tarta/')
      .first()
    await expect(firstCard).toBeVisible({ timeout: 10000 })
    const recipeTitle = await firstCard.textContent()
    await firstCard.click()
    // Recipe detail shows the cook mode button
    await expect(page.getByText(/Iniciar cocina|Receta/i).first()).toBeVisible({ timeout: 8000 })
    // Title still visible in detail header
    await expect(page.getByText(recipeTitle ?? '').first()).toBeVisible()
  })
})
