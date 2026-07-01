import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    passWithNoTests: true,
    exclude: ['e2e/**', '**/node_modules/**', 'src/__screen-tests__/**', 'src/__mocks__/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      // Only measure pure utility modules that have unit tests.
      // Screens, components, api client and providers require browser/E2E coverage (spike #471).
      include: ['src/utils/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      thresholds: {
        statements: 100,
        lines: 100,
        branches: 100,
        functions: 100,
      },
    },
  },
})
