import { defineConfig, devices } from '@playwright/test'
import { DEMO_ACCOUNTS } from './e2e/demoAccounts'
import { APP_URL } from './e2e/env'

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  // One shared wait budget instead of a timeout on every call (2026-10-01 audit,
  // QA automation). Pass an explicit timeout only when a step is known to be slower.
  expect: { timeout: 10000, toPass: { timeout: 10000 } },
  // CI retries once to tell a flake from a real failure, and a test that only passed
  // on retry still fails the run — retries diagnose flakiness, they don't hide it.
  retries: process.env['CI'] ? 1 : 0,
  failOnFlakyTests: !!process.env['CI'],
  // One worker per seeded demo account (see e2e/demoAccounts.ts) — never raise
  // this independently of the account list, or workers will share a session.
  workers: DEMO_ACCOUNTS.length,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: APP_URL,
    trace: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 15000,
    // E2E_SCREENSHOTS=true keeps a full-page screenshot of the final state of every
    // test (plus the visual-tour spec) in test-results/, for the Auditar QA
    // persona's aesthetic/design/workflow review. Off by default locally.
    screenshot: process.env['E2E_SCREENSHOTS'] === 'true' ? { mode: 'on', fullPage: true } : 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Start the Expo web server before running E2E tests
  // webServer not used — CI handles the app server separately via docker build + serve.
  // Local: `pnpm e2e:local` (isolated E2E stack on :8081/:3001, reset before and after).
  webServer: undefined,
})
