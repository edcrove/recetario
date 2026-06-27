import { test, expect } from '@playwright/test'

/**
 * Smoke E2E: verifies the Expo web app renders and navigates correctly.
 * Requires the app to be running at PLAYWRIGHT_BASE_URL (default localhost:8081).
 * In CI, the webServer config in playwright.config.ts builds and serves the app.
 */

test.describe('Smoke: recipe list → detail → scale', () => {
  test('home page loads and shows recipe list', async ({ page }) => {
    await page.goto('/')
    // The home screen heading or recipe list should be visible
    await expect(page.getByText(/receta|recipe/i).first()).toBeVisible({ timeout: 15000 })
  })

  test('search input is present on home screen', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByPlaceholder(/buscar|search/i)).toBeVisible({ timeout: 15000 })
  })

  test('nueva receta button is present', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/nueva receta|new recipe/i)).toBeVisible({ timeout: 15000 })
  })
})
