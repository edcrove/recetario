import { test as base, expect } from '@playwright/test'

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000'
const DEMO_EMAIL = process.env['E2E_EMAIL'] ?? 'demo@recetario.app'
const DEMO_PASSWORD = process.env['E2E_PASSWORD'] ?? 'demo1234'

/**
 * Extended test fixture that logs in before each test.
 * Uses localStorage to persist the JWT token (same as authStorage.ts on web).
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    // Get JWT from API
    const res = await page.request.post(`${API_URL}/auth/login`, {
      data: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
    })
    const { token } = (await res.json()) as { token: string }

    // Inject token into localStorage before navigating
    await page.goto('/')
    await page.evaluate((jwt) => {
      localStorage.setItem('auth_token', jwt)
    }, token)

    // Navigate to trigger the auth check with the token set
    await page.goto('/')
    await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 10000 })

    await use(page)
  },
})

export { expect }
