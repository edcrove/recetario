import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['src/__tests__/integration/globalSetup.ts'],
    testTimeout: 30000,
    hookTimeout: 120000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/__tests__/**',
        'src/scripts/**',
        'src/index.ts',
        'src/types.ts',
        'src/db/schema/**',
        'src/db/cook-sessions-repository.ts',
      ],
      thresholds: {
        statements: 100,
        branches: 98,
        functions: 80,
        lines: 100,
      },
    },
  },
})
