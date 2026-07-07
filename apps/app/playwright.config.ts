import { defineConfig, devices } from '@playwright/test'
import { DEMO_ACCOUNTS } from './e2e/demoAccounts'

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: process.env['CI'] ? 1 : 0,
  // One worker per seeded demo account (see e2e/demoAccounts.ts) — never raise
  // this independently of the account list, or workers will share a session.
  workers: DEMO_ACCOUNTS.length,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:8080',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Start the Expo web server before running E2E tests
  // webServer not used — CI handles the app server separately via docker build + serve.
  // Local: run `docker compose up -d` then `pnpm test:e2e` in apps/app.
  webServer: undefined,
})
