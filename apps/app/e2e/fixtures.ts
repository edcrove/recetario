import { test as base, expect } from '@playwright/test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { DEMO_ACCOUNTS } from './demoAccounts'

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000'
const COLLECT_COVERAGE = process.env['E2E_COVERAGE'] === 'true'
// Istanbul coverage goes to .e2e-coverage/ for nyc merge
const COVERAGE_DIR = path.join(process.cwd(), '.e2e-coverage')

async function saveCoverage(page: import('@playwright/test').Page, title: string) {
  if (!COLLECT_COVERAGE) return
  const coverage = await page.evaluate(
    () => (window as unknown as { __coverage__?: unknown }).__coverage__ ?? null,
  )
  if (coverage) {
    fs.mkdirSync(COVERAGE_DIR, { recursive: true })
    const testTitle = title.replace(/[^a-z0-9]/gi, '-').toLowerCase()
    fs.writeFileSync(
      path.join(COVERAGE_DIR, `${testTitle}-${Date.now()}.json`),
      JSON.stringify(coverage),
    )
  }
}

/**
 * Authenticated test fixture:
 * 1. Logs in before each test (JWT → localStorage)
 * 2. Optionally collects Istanbul coverage from window.__coverage__
 *    (requires build:coverage — BABEL_ENV=coverage expo export)
 */
export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const account = DEMO_ACCOUNTS[testInfo.parallelIndex]
    if (!account) {
      throw new Error(
        `No demo account configured for worker index ${testInfo.parallelIndex}. ` +
          `demoAccounts.ts only has ${DEMO_ACCOUNTS.length} accounts — add one there and seed it ` +
          `(pnpm --filter @recetario/api seed:e2e-accounts) before running with more workers.`,
      )
    }

    const res = await page.request.post(`${API_URL}/auth/login`, {
      data: { email: account.email, password: account.password },
    })
    const { token } = (await res.json()) as { token: string }

    await page.goto('/')
    await page.evaluate((jwt) => {
      localStorage.setItem('auth_token', jwt)
    }, token)

    await page.goto('/')
    await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 10000 })
    await page.waitForLoadState('networkidle', { timeout: 15000 })

    await use(page)

    await saveCoverage(page, testInfo.title)
  },
})

/**
 * Unauthenticated test fixture — same coverage collection, no login.
 * Use for testing auth screens (login/register forms) themselves.
 */
export const testUnauth = base.extend({
  page: async ({ page }, use, testInfo) => {
    await use(page)
    await saveCoverage(page, testInfo.title)
  },
})

export { expect }
