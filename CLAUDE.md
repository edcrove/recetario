# Recetario — Agent Guidance

## Project

Recetario is an **agent-first** recipe management application built as a pnpm monorepo. The primary write path runs through MCP (Model Context Protocol): an AI agent calls tools exposed by `@recetario/mcp`, which in turn calls the Hono REST API (`@recetario/api`), which writes to PostgreSQL via Drizzle ORM. The mobile/web app (`recetario-app`, powered by Expo + React Native) is a **read-only consumer** of the API — it performs no LLM inference. All intelligence lives at the MCP layer.

## Monorepo layout

| Path              | Package             | Role                                                          |
| ----------------- | ------------------- | ------------------------------------------------------------- |
| `packages/shared` | `@recetario/shared` | Domain types, constants, utilities shared across all packages |
| `packages/api`    | `@recetario/api`    | Hono REST API; reads/writes Postgres via Drizzle              |
| `packages/mcp`    | `@recetario/mcp`    | MCP server; exposes agent tools that call the API             |
| `apps/app`        | `recetario-app`     | Expo (React Native + Web) app; read-only UI                   |

## Key commands

```bash
# Development
pnpm dev                        # Start all packages in watch mode (turbo)
pnpm --filter @recetario/api dev        # Start only the API

# Build
pnpm build                      # Build all packages (turbo)

# Lint & format
pnpm lint                       # ESLint across all packages

# Tests
pnpm test                       # Run all Vitest suites (no DB required)
pnpm --filter recetario-app test:screens   # Screen component tests (jsdom)
pnpm ci:local                   # Full pipeline: lint + typecheck + test + build
pnpm ci:full                    # Same + integration tests (requires Docker)

# Type checking
pnpm typecheck                  # tsc --noEmit across all packages (turbo)

# Database
docker compose up -d            # Start Postgres 17
pnpm --filter @recetario/api exec drizzle-kit generate   # Generate migrations
pnpm --filter @recetario/api exec drizzle-kit migrate    # Apply migrations
pnpm --filter @recetario/api exec drizzle-kit studio     # Open Drizzle Studio

# PR workflow
pnpm pr                         # Run CI, capture evidence, open PR with it pre-filled
pnpm pr --draft                 # Same but as draft
SKIP_PRE_PUSH=1 git push        # Bypass pre-push hook (emergencies only)
```

## Two local environments (data independence)

The default docker stack (Postgres `recetario` / API `:3000` / app `:8080`) is
the **manual** environment — poke at it by hand, its demo data persists.

A separate **E2E** stack (profile `e2e`: own Postgres `recetario_e2e` on `:5433`
/ API `:8081`→`:3001` / app `:8081`) runs automated tests without ever touching
the manual data. It is reset to a clean seeded baseline **before and after**
each run.

```bash
pnpm e2e:up        # build + start the isolated E2E stack
pnpm e2e:reset     # truncate + reseed taxonomy + 4 demo accounts (E2E DB only)
pnpm e2e:local     # reset → run Playwright against :8081 → reset (clean before + after)
pnpm e2e:local recipes.spec.ts   # same, filtered to one spec
pnpm e2e:down      # stop the E2E stack
```

Never point local E2E at `:8080`/`:3000` — that pollutes the manual data.
CI is unaffected (it already uses an ephemeral per-run Postgres).

## Agent-first principle

> The app does **no inference**. Zero.

All AI interactions flow through the MCP server:

```
Agent (Claude / GPT / etc.)
  └─► MCP tools (@recetario/mcp)
        └─► REST API (@recetario/api)
              └─► PostgreSQL (Drizzle ORM)
```

The Expo app reads data from the API like any other REST client. It never calls an LLM directly.

## Conventions

- **Commits**: Conventional Commits (`feat`, `fix`, `chore`, `docs`, `test`, `refactor`). Enforced by commitlint + husky. Subject ≤100 chars, lowercase.
- **Branch naming**: `feat/<story-slug>`, `fix/<issue>`, `chore/<task>`, `test/<scope>`.
- **Stories**: One focused commit per story. Include the Notion story URL in the commit body.
- **TypeScript**: Strict mode everywhere (`strict: true`, `noUncheckedIndexedAccess`, `noImplicitOverride`). No `any` unless absolutely necessary.
- **Tests**: Vitest for all unit/integration tests. Screen component tests use Vitest + jsdom + custom RN mock (see `apps/app/src/__mocks__/react-native.tsx`). No Jest.
- **Formatting**: Prettier 3 with the project `.prettierrc.json`. Run before every commit (lint-staged).

## Git workflow

1. **pre-commit** (automatic): lint-staged runs ESLint + Prettier on staged files.
2. **pre-push** (automatic): runs `lint → typecheck → test → build`. Fails fast. Saves output to `.last-ci-output.txt`.
3. **`pnpm pr`**: runs CI, captures evidence, creates PR with structured description.
4. Aim for 100% coverage; the configured thresholds are defined lower bounds, never targets. Never lower a threshold — write the tests (or add a justified source-level exclusion) instead. See "Coverage approach" below.

## Testing rules (CRITICAL)

### Every story must complete the full testing pyramid

Each new feature must include tests at every applicable layer before the PR can merge:

| Layer                 | Tool                    | What to cover                                 | Threshold                              |
| --------------------- | ----------------------- | --------------------------------------------- | -------------------------------------- |
| **Unit — logic**      | vitest (node)           | New utils, domain functions, MCP tools        | 100% statements/lines/branches         |
| **Unit — API routes** | vitest (node)           | Every new route: 200, 400, 401, 404           | 100% statements/lines, 98% branches    |
| **Integration**       | vitest + testcontainers | DB constraints, multi-step flows              | All happy path + key error paths       |
| **Screen**            | vitest + jsdom          | App screens with non-trivial logic            | Key interactions and state changes     |
| **E2E**               | Playwright              | Critical user flows involving the new feature | At minimum 1 smoke test per new screen |

**Never ship a story without tests at every layer that applies.** If a layer isn't applicable (e.g., a backend-only story has no E2E), document why in the PR description.

### Coverage approach — aim for 100%, floors are the defined lower bounds

**The target is always 100%** — statements, branches, functions, and lines, at every
applicable layer. The numbers configured in CI are **defined lower bounds** (a safety
net), **not** the goal. Treat any gap below 100% as debt to close, not as budget to spend.

Working rules:

1. **New code ships at 100%.** When a change adds code, write tests until the new code
   is fully covered at every layer that applies. Never merge a feature that pushes a
   metric down toward its floor "because there's still room."
2. **Unreachable-by-design code is excluded at the source, not accommodated by a lower floor.**
   Use `/* v8 ignore … */` (vitest) or `/* istanbul ignore … */` (E2E/nyc) at the exact
   site, with a one-line justification, so measured coverage reflects 100% of what is
   genuinely reachable. Prefer this over lowering a threshold.
3. **Floors only ratchet up.** Never lower a threshold to make CI pass — write the tests
   (or add a justified source-level exclusion) instead. Raise a floor once a gap is
   permanently closed to lock the gain in.

Current enforced lower bounds:

| Layer / package                | Statements | Lines | Branches | Functions | Notes                                                     |
| ------------------------------ | ---------- | ----- | -------- | --------- | --------------------------------------------------------- |
| `packages/api`                 | 100%       | 100%  | 98%      | 80%       | DB repos are covered by integration, not unit             |
| `packages/shared`              | 100%       | 100%  | 100%     | 100%      | at target                                                 |
| `packages/mcp`                 | 100%       | 100%  | 100%     | 100%      | at target                                                 |
| `apps/app` (utils scope)       | 100%       | 100%  | 100%     | 100%      | at target                                                 |
| `apps/app` E2E (`.nycrc.json`) | 95%        | 96%   | 84%      | 94%       | ratchet toward 100%; native-only paths excluded at source |

Scripts (`src/scripts/**`), entrypoints (`src/index.ts`), type files, and DB schema are excluded.
The sub-100% floors above are the only accepted lower bounds and each has a documented reason;
everywhere else the floor is 100% because that is the target.

### Test environments

- **`packages/api`**: `node` + Postgres integration tests (skip when `SKIP_INTEGRATION=true`)
- **`packages/shared`**: `node`, pure unit tests
- **`packages/mcp`**: `node`, mocked API client
- **`apps/app`** (unit): `node` — extract pure logic to utils, test that. No React rendering.
- **`apps/app`** (screen): `jsdom` via `vitest.screen.config.ts` — uses `src/__mocks__/react-native.tsx`.

### Patterns for testable code

- Extract screen-embedded logic to pure utils before testing (e.g. `cookModeNav`, `homeScreen`, `weekMath`, `recipeForm`, `menuLogic`, `cookEffects`).
- `vi.mock()` factories cannot reference outer variables — use `vi.hoisted()`.
- React hooks: `renderHook` + `vi.useFakeTimers()` in jsdom environment.
- Auth routes: mock `getDb` and `schema`, let bcrypt/JWT helpers run for real.

## Database conventions

- **ORM**: Drizzle ORM with `postgres-js`.
- **Migrations**: always generated with `drizzle-kit generate`, applied with `drizzle-kit migrate`. Never edit migration files manually.
- **Schema changes**: update `packages/api/src/db/schema/index.ts` → generate → migrate → export new Zod schemas in `packages/shared/src/`.
- **New entities**: add Zod schemas to shared (e.g. `taxonomy.ts`, `schema.ts`) and export from `shared/src/index.ts`.
- **Seed data**: `src/scripts/seed.ts` (guarded by `NODE_ENV !== 'test'`). Taxonomy (meal_categories, food_types) seeded at startup.

## Auth conventions

- **Middleware order**: JWT first → API key hash (DB lookup) → DEV_API_KEY fallback (CI/dev only).
- **JWT**: signed with `jose`, 7-day expiry, payload: `{ sub: userId, email, householdId? }`.
- **API keys**: SHA-256 hash stored in DB. Used by MCP agents.
- **ownerId**: always a `users.id` UUID. The string `'dev'` is only used in legacy/test contexts before migration.

## Package installation rules

- **Always install at workspace root**: `pnpm --filter <package> add <dep>`
- **Never create a local `pnpm-lock.yaml`** in a subpackage — this breaks CI's `--frozen-lockfile`.
- **Expo SDK packages**: always use `npx expo install` to get SDK-compatible versions. Never bump `react-native` or `expo-*` independently.

## PR conventions

- Title: Conventional Commit format, ≤72 chars, clear and specific.
- Description: use the template (`.github/PULL_REQUEST_TEMPLATE.md`) — fill all sections including evidence.
- Evidence section: paste actual CI output, screenshots for UI changes, migration output for DB changes.
- Notion story → "In review" + PR link before requesting review.
- Use `pnpm pr` to automate this.
- **PRs require 1 approving review** before merge (branch protection on `main`).
- **No ESLint warnings**: CI runs `eslint --max-warnings=0`. Fix all warnings before pushing.
- **Dependabot alerts**: check open Dependabot security alerts before merging. Address or acknowledge each one. Patch/minor updates are auto-merged when CI passes.

## Notion

Stories and the project roadmap live at:
https://app.notion.com/p/3d20a1ab4ba245bca87a2aaa11c4b278

**Lifecycle**: Backlog → Ready → In progress → In review → Done.
Update status when starting (In progress) and when PR is open (In review) and merged (Done).
Include the PR link in the story's PR field.

### Key epic IDs

- #390 Identity (users, auth, households) — blocks all personalization features
- #500 Cooking history & analytics
- #510 Taxonomy, collections & recipe relations
- #520 Taxonomy configurator

## Secrets & environment variables

### Required vars per environment

| Variable              | Package | Required in prod | Notes                                                                     |
| --------------------- | ------- | ---------------- | ------------------------------------------------------------------------- |
| `DATABASE_URL`        | api     | ✅               | Postgres connection string                                                |
| `JWT_SECRET`          | api     | ✅               | ≥64 random hex chars. **Fails fast at startup if missing in production.** |
| `DEV_API_KEY`         | api     | ❌               | Local/CI fallback auth. Never in production.                              |
| `API_BASE_URL`        | mcp     | ✅               | URL of the API the MCP server calls                                       |
| `MCP_API_KEY`         | mcp     | ✅               | API key for MCP→API auth (from api_keys table)                            |
| `EXPO_PUBLIC_API_URL` | app     | ✅               | Public — embedded at build time                                           |
| `EXPO_PUBLIC_API_KEY` | app     | ❌               | Public — never put secrets here                                           |

### Local development

Copy `.env.example` to `.env` at root and per-package. All `.env` files are gitignored.

### Generating secrets

```bash
# JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# API key pair (key to share + hash to store in DB)
pnpm --filter @recetario/api exec tsx src/scripts/generate-key.ts
```

### Production safeguard

`JWT_SECRET` throws at startup if `NODE_ENV=production` and the var is missing or is the default value. This prevents accidental insecure deploys.

## React Native / Expo rules

- **Current SDK**: Expo 56, React Native 0.85, React 19.
- **Expo upgrades**: bump `expo` SDK first via `npx expo install`, never `react-native` alone.
- **Component testing**: use `vitest.screen.config.ts` (jsdom + `src/__mocks__/react-native.tsx`). Do not use jest-expo (version conflicts with Vite 7).
- **Screen logic**: extract to pure utils in `src/utils/` before testing. Do not test JSX directly unless necessary.
- **MCP server tools**: registered via `registerAllTools()` — add new tools there.
- **React Native Web gotchas**: `Alert.alert()` is a documented no-op on web (`static alert() {}` in react-native-web). Use `src/utils/platformAlert.ts` (`confirmAsync`/`notify`) instead of `Alert.alert` directly for any confirm dialog or error notification that must work on web. Audit other RN-only APIs (`Vibration`, `Share`, `Clipboard`, `Linking`) for the same class of silent-no-op bug before relying on them in web-facing flows.

## Full project audit: "Auditar"

Typing **"Auditar"** (as its own message, case-insensitive) triggers `.claude/skills/auditar/SKILL.md` — an 11-agent parallel audit of the whole project (QA, Backend, Frontend, UX/UI, Nutrition, parent/family user persona, read-only user persona, Product Management, Data Science, Clean Code/Architecture, QA Automation Architecture). Heavy operation (10-20 min, 11 parallel agents) — only run when the user explicitly asks. See the skill file for the full persona scopes, output format, and Notion consolidation steps.
