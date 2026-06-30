import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    passWithNoTests: true,
    exclude: ['e2e/**', '**/node_modules/**', 'src/__screen-tests__/**', 'src/__mocks__/**'],
  },
})
