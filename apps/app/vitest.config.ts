import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    passWithNoTests: true,
    exclude: ['e2e/**', '**/node_modules/**'],
  },
})
