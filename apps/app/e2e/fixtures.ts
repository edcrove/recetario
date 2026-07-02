import { test as base, expect } from '@playwright/test'
import * as fs from 'node:fs'
import * as path from 'node:path'

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000'
const DEMO_EMAIL = process.env['E2E_EMAIL'] ?? 'demo@recetario.app'
const DEMO_PASSWORD = process.env['E2E_PASSWORD'] ?? 'demo1234'
const COLLECT_COVERAGE = process.env['E2E_COVERAGE'] === 'true'
const COVERAGE_DIR = path.join(process.cwd(), '.e2e-coverage')

/**
 * Extended test fixture that:
 * 1. Logs in before each test (JWT → localStorage)
 * 2. Optionally collects v8 JS coverage (set E2E_COVERAGE=true)
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    // Start v8 coverage collection if requested
    if (COLLECT_COVERAGE) {
      await page.coverage.startJSCoverage()
    }

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
    // Wait for home screen to be fully loaded (recipe list or empty state)
    await page.waitForLoadState('networkidle', { timeout: 15000 })

    await use(page)

    // Stop and save v8 coverage
    if (COLLECT_COVERAGE) {
      const coverage = await page.coverage.stopJSCoverage()
      if (coverage.length > 0) {
        fs.mkdirSync(COVERAGE_DIR, { recursive: true })
        const timestamp = Date.now()
        const testTitle = test
          .info()
          .title.replace(/[^a-z0-9]/gi, '-')
          .toLowerCase()
        fs.writeFileSync(
          path.join(COVERAGE_DIR, `${testTitle}-${timestamp}.json`),
          JSON.stringify(coverage, null, 2),
        )
      }
    }
  },
})

export { expect }
