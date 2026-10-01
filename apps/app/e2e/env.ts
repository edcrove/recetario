/**
 * Where E2E runs point. Defaults are the isolated E2E stack (API :3001, app
 * :8081 — see `pnpm e2e:up`), never the manual stack on :3000/:8080, so a bare
 * `playwright test` can't pollute hand-made data. CI and `pnpm e2e:local` set
 * both variables explicitly.
 */
export const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001'
export const APP_URL = process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:8081'
