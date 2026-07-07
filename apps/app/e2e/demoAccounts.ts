export interface DemoAccount {
  email: string
  password: string
}

/**
 * One account per Playwright worker, so concurrent workers never share a
 * session (menu/household/taxonomy state would otherwise collide and cause
 * flaky failures). playwright.config.ts pins `workers` to this array's
 * length, and fixtures.ts throws if a worker index has no matching account —
 * that coupling is intentional: adding parallelism requires adding an
 * account here AND seeding it (pnpm --filter @recetario/api seed:e2e-accounts),
 * never just raising a worker count in isolation.
 */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: 'demo@recetario.app', password: 'demo1234' },
  { email: 'demo2@recetario.app', password: 'demo1234' },
  { email: 'demo3@recetario.app', password: 'demo1234' },
  { email: 'demo4@recetario.app', password: 'demo1234' },
]
