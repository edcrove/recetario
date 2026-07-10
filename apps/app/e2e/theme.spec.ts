import { test, expect } from './fixtures'

// Theme selector (visual epic follow-up): Sistema/Claro/Oscuro persists the
// choice (overriding the OS scheme) so the app is dark even when the OS is light.
test.describe('Theme selector', () => {
  test('forcing dark persists across reloads and can be reset to Sistema', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/profile')
    await expect(page.getByTestId('theme-dark')).toBeVisible({ timeout: 10000 })

    await page.getByTestId('theme-dark').click()
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('theme_preference')))
      .toBe('dark')

    // Survives a reload (still dark despite the OS being light).
    await page.reload()
    await expect(page.getByTestId('theme-dark')).toBeVisible({ timeout: 10000 })
    expect(await page.evaluate(() => localStorage.getItem('theme_preference'))).toBe('dark')

    // Reset so the choice doesn't leak into other specs sharing the account.
    await page.getByTestId('theme-system').click()
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('theme_preference')))
      .toBe('system')
  })
})
