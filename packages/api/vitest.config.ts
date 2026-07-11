import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Integration tests (and their globalSetup, which spins up Testcontainers
    // or connects to a real Postgres) belong only to vitest.integration.config.ts,
    // which also sets fileParallelism: false. Without this exclude, running the
    // standard `pnpm test` on a machine where Docker happens to be reachable
    // would pick up *.integration.test.ts too, but WITHOUT fileParallelism:
    // false — multiple files' beforeAll hooks would call resetTestDb() (a real
    // TRUNCATE) concurrently against the same database, each wiping out
    // whatever another file had just inserted.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
      'src/__tests__/integration/**',
    ],
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
        // These three are integration-test-only by design (real DB queries,
        // no meaningful mock): covered at 100% by
        // `test:integration-coverage` (vitest.integration.config.ts), not
        // this standard/unit config — which no longer runs
        // *.integration.test.ts at all (see the test.exclude above).
        'src/db/cook-sessions-repository.ts',
        'src/db/repository.ts',
        'src/db/menu-repository.ts',
        'src/db/ingredient-repository.ts',
        'src/db/seed-ingredients.ts',
        'src/db/pantry-repository.ts',
        'src/db/household-visibility.ts',
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
