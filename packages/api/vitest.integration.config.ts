/**
 * Integration test coverage config.
 * Runs ALL tests including integration (SKIP_INTEGRATION=false).
 * Requires Docker Postgres — use in CI with postgres service.
 *
 * pnpm --filter @recetario/api exec vitest run --config vitest.integration.config.ts --coverage
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['src/__tests__/integration/globalSetup.ts'],
    testTimeout: 60000,
    hookTimeout: 180000,
    // Every integration file shares one real Postgres instance that's never
    // wiped between files (only resetDb()'s cached-client reset). Running
    // files in parallel lets them race on shared/colliding fixture data —
    // each file's own `.sequential()` only orders tests within that file.
    fileParallelism: false,
    env: {
      SKIP_INTEGRATION: 'false',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json'],
      reportsDirectory: './coverage-integration',
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
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
})
