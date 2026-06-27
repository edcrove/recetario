import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:8081',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Start the Expo web server before running E2E tests
  webServer: process.env['CI']
    ? {
        command: 'pnpm build && npx serve dist --listen 8081',
        url: 'http://localhost:8081',
        reuseExistingServer: false,
        timeout: 120000,
        env: {
          EXPO_PUBLIC_API_URL: process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000',
          EXPO_PUBLIC_API_KEY: process.env['EXPO_PUBLIC_API_KEY'] ?? 'dev-key',
        },
      }
    : undefined,
})
