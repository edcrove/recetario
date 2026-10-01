# Decision log

Lightweight, append-only record of decisions taken in working sessions (with the
owner or an agent) that are too small for an ADR but must not live only in a chat.
Big architectural choices still get an ADR in `docs/adr/`; link it from here.

The "Auditar" skill (persona 12, planning & decisions sync) reads this file and checks
each entry against the code, the ADRs, `CLAUDE.md` and the Notion roadmap.

**How to add an entry**: newest first. One entry per decision. Keep the fields below;
`Status` is `active`, `superseded by <link>` or `revisit when <condition>`.

---

## 2026-10-01 — Audit fixes

### D-2026-10-01-1 · API error contract and transactional writes

- **Decision**: every error the API returns is JSON with an `error` field. Request
  validation failures are `400 { error: 'Validation error', details: [{ path, message }] }`
  (shared `createRouter()` hook). Unhandled errors go through `app.onError`: Postgres FK
  violations → 400, unique violations → 409, invalid values → 400, anything else → 500
  `{ error: 'Internal server error' }`; unknown routes → 404 JSON. Multi-statement writes
  (recipe create/update/upsert/fork, household create) run in one transaction
  (`db/transaction.ts`), and recipe `foodTypeIds` must be system or the caller's own.
- **Why**: Auditar 2026-10-01 reproduced an orphan recipe after a 500, plain-text 500s on
  impossible dates, and Zod's raw error shape leaking to MCP agents.
- **Where it lives**: `packages/api/src/index.ts`, `src/routes/router.ts`,
  `src/db/transaction.ts`, `src/db/repository.ts`.
- **Status**: active

### D-2026-10-01-2 · The ingredient catalog is shared per deployment; system rows are read-only

- **Decision**: canonical ingredients and synonyms stay global to the deployment (one
  family per deploy, ADR-012). Curated system rows can't be deleted or remapped (409);
  user-added rows are shared by everyone on that deploy.
- **Why**: any user could remap a system synonym and corrupt every household's shopping
  list. Per-owner catalogs would need a schema change that a single-family deploy doesn't
  need yet.
- **Where it lives**: `packages/api/src/db/ingredient-repository.ts` (`setSynonym`).
- **Status**: revisit when one deployment serves more than one family.

### D-2026-10-01-3 · Stored URLs are http(s) only (recorded from PR #158)

- **Decision**: recipe source URL, images, avatar and MCP `sourceUrl` must be http(s).
  Rows stored before the check are not migrated; the app hides non-http(s) source links.
- **Where it lives**: `packages/shared/src/schema.ts` (`HttpUrlSchema`),
  `apps/app/src/utils/sourceHost.ts` (`isHttpUrl`).
- **Status**: revisit if a data cleanup migration is wanted.

### D-2026-10-01-4 · Partial recipe updates (recorded from PR #155)

- **Decision**: `PUT /v1/recipes/:id` is a partial update: an omitted field stays as is;
  a field that is sent replaces the stored value (arrays replace the whole list).
- **Where it lives**: `UpdateRecipeSchema` (no defaults), `RecipeRepository.update`.
- **Status**: active

### D-2026-10-01-7 · Recipe nutrition follows edits

- **Decision**: on a recipe update, an explicit `nutrition` (object, or `null` to clear)
  wins; otherwise a servings-only change rescales the per-serving values and any
  ingredient change clears them (`null`, shown as "sin datos") until an agent re-estimates.
- **Why**: per-serving nutrition silently went stale after edits and there was no way to
  unset it (2026-10-01 audit, Nutrition/Backend). A wrong number is worse than none.
- **Where it lives**: `packages/shared/src/recipeNutrition.ts` (`nutritionAfterEdit`),
  `RecipeRepository.updateInTx`, `CreateRecipeSchema.nutrition` (nullable on input), MCP
  `updateRecipe` description.
- **Status**: active

### D-2026-10-01-5 · Day and week nutrition are per-person intake

- **Decision**: the day rollup (`computeDayNutrition`), the week view
  (`GET /v1/menu/nutrition`) and suggestion `goalFit` count **one portion per planned
  dish** — the intake of the person whose targets they are compared against — instead of
  per-serving nutrition × planned servings.
- **Why**: targets are personal; a family of 4 planning a 600 kcal dinner showed 2400 kcal
  against one adult's goal, so deltas and `goalFit` were inflated ~N×. Planned servings
  still drive the shopping list and scaling, not intake.
- **Where it lives**: `packages/shared/src/dayNutrition.ts`, `routes/menu.ts`,
  `DayNutritionSummary` ("Por persona"), MCP `getDayNutrition` description.
- **Status**: active — revisit when households track per-member portions.

### D-2026-10-01-6 · Household viewers are read-only on every shared surface

- **Decision**: an accepted `viewer` gets 403 on menu writes, shopping-list check-offs and
  shared-pantry writes. Their own recipes and cook history never surface to the other
  members (`getVisibleOwnerIds` skips viewer members), so they can keep personal recipes
  without writing into the household. The app hides those controls and shows a
  "solo lectura" notice (`ViewerNotice`) on menu, shopping list and pantry.
- **Why**: the 2026-10-01 audit found `viewer` enforced only on menu writes; viewers could
  still edit the shared pantry, check items off and publish recipes into the household,
  and the UI hid buttons without saying why.
- **Where it lives**: `packages/api/src/db/household-visibility.ts`, `routes/pantry.ts`,
  `routes/menu.ts`, `apps/app/src/hooks/useIsViewer.ts`, `src/components/ViewerNotice.tsx`.
- **Status**: active

## 2026-09-30 — Dependency & maintenance session (PRs #125, #140, #147, #148, #124)

### D-2026-09-30-12 · Production startup guard, closed sign-up and release step

- **Decision**: with `NODE_ENV=production` the API refuses to start unless `JWT_SECRET` is
  ≥64 hex chars and not a repo placeholder, and `DEV_API_KEY` is unset. docker-compose and
  CI mimic production but set `ALLOW_DEV_SECRETS=true`, which keeps only the "secret is
  set" check. Sign-up is closed in production unless `REGISTRATION_OPEN=true`. Every start
  runs `release.ts` (Drizzle migrator + base taxonomy/ingredient seed, no demo recipes)
  before the server; the Docker entrypoint uses the same step.
- **Why**: deploy story acceptance criteria (ADR-012). An env flag, not invite tokens,
  because the family is ~4 people and accounts are opened once.
- **Where it lives**: `packages/api/src/config/production.ts`, `src/scripts/release.ts`,
  `railway.json`, `docs/deploy/railway.md`.
- **Status**: active. Revisit sign-up (invite tokens) when non-family users arrive.

### D-2026-09-30-11 · Password reset is an admin script until there is an email provider

- **Decision**: the forgot-password screen no longer asks for an email or claims one was
  sent. It tells the user to ask whoever runs their household, who runs
  `pnpm --filter @recetario/api reset-password <email>` against the deployed DB and hands
  over the printed temporary password.
- **Why**: Auditar 2026-09-30 found the screen promised a reset email that never
  existed. The first deploy is for one family; an email provider (and reset tokens) is
  cost and setup that no one needs yet.
- **Where it lives**: `apps/app/app/auth/forgot.tsx`,
  `packages/api/src/scripts/reset-password.ts`.
- **Status**: revisit when the app has users outside the owner's family (then add an email
  provider and a token-based reset flow).

### D-2026-09-30-10 · Per-IP rate limit on login and register

- **Decision**: `POST /auth/login` and `POST /auth/register` share a per-IP sliding
  window of 10 requests/minute (`AUTH_RATE_LIMIT_MAX_REQUESTS`); over it they return 429
  with `Retry-After: 60`. The client IP is the rightmost `X-Forwarded-For` entry (one
  proxy hop, e.g. Railway), else the socket address. The per-account recipe limiter now
  applies to writes only, and both limiters prune empty windows (full sweep once a minute).
  CI, docker-compose and the integration suite raise the auth limit via env.
- **Why**: Auditar 2026-09-30 found no brute-force protection on the unauthenticated
  auth endpoints, a prerequisite for the first public deploy. In-memory is enough for a
  single API instance.
- **Where it lives**: `packages/api/src/middleware/rateLimit.ts`, `routes/auth.ts`.
- **Status**: revisit when the API runs more than one instance (move the store to
  Postgres/Redis) or sits behind more than one proxy hop.

### D-2026-09-30-9 · Household sharing starts only when the invite is accepted

- **Decision**: household visibility (recipes, menu, shopping list, pantry, day
  nutrition) and the viewer write restriction only count memberships with
  `acceptedAt` set, on both sides. A pending invite shares nothing and restricts nothing.
- **Why**: Auditar 2026-09-30 found (and confirmed live) that inviting any registered
  email immediately exposed both users' private data, and that a pending viewer invite
  blocked the invitee's own menu. The UI already showed such members as "Pendiente".
- **Where it lives**: `packages/api/src/db/household-visibility.ts`; regression tests in
  `household-sharing.integration.test.ts`.
- **Status**: active. Invitees accept or decline in the app (home banner → Mi hogar) or
  through the MCP tool `respondToHouseholdInvitation`. A pending membership also grants
  no management rights (invite/remove), and the owner cannot be removed.

### D-2026-09-30-8 · Visual regression screenshots reviewed by the QA auditor

- **Decision**: with `E2E_SCREENSHOTS=true`, Playwright keeps a full-page screenshot of
  every E2E test's final state, and `e2e/visual-tour.spec.ts` captures every screen at
  phone/desktop width in light/dark mode. CI always runs it and uploads the
  `e2e-screenshots` artifact (14 days). The Auditar QA persona must review every
  screenshot for aesthetic, design-consistency and workflow issues.
- **Why**: the E2E suite asserts behaviour, not looks. Visual and flow problems (e.g. a
  header that stays white in dark mode) were invisible to every automated check.
- **Where it lives**: `apps/app/playwright.config.ts`, `apps/app/e2e/visual-tour.spec.ts`,
  `.github/workflows/ci.yml` (E2E job), `.claude/skills/auditar/SKILL.md` (prerequisite 4,
  persona 1).
- **Status**: active. The tour asserts that every screen renders; it does not compare
  pixels. Add pixel baselines only if the review becomes repetitive.

### D-2026-09-30-7 · Effort levels per skill and subagent

- **Decision**: the `auditar` skill runs at `effort: high`. Its personas run as two
  read-only agent types: `audit-deep` (`high`: QA, Backend, Frontend, Nutrition, Clean
  Code, QA Automation, Planning sync) and `audit-persona` (`medium`: UX, parent user,
  read-only user, Product, Data Science). New skills/agents declare `effort` by kind of
  work (see CLAUDE.md, Agent harness).
- **Why**: correctness/security/drift findings need deep tracing; persona walkthroughs
  don't gain findings from more effort, only cost. The `Agent` tool has no per-call
  effort, so agent types carry it. They block file edits and the GitHub/Notion write
  tools (extended 2026-09-30 after the audit found only Notion page writes were blocked);
  Bash stays available for tests, so "investigate only" is enforced for tools and asked
  of the agent for shell use.
- **Where it lives**: `.claude/skills/auditar/SKILL.md`, `.claude/agents/audit-*.md`.
- **Status**: active

### D-2026-09-30-6 · Model-agnostic agent harness

- **Decision**: repo skills and settings do not pin model aliases or IDs; subagents
  (e.g. the 12 Auditar personas) inherit the session model. A cheaper alias is passed
  only when the user asks for a lighter pass. Permissions cover the Notion connector
  names of both the desktop/CLI and cloud surfaces.
- **Why**: the Auditar skill pinned a weaker default model and the harness only matched
  desktop Notion tool names, so cloud sessions prompted for every Notion call.
- **Where it lives**: `.claude/skills/auditar/SKILL.md`, `.claude/settings.json`,
  `CLAUDE.md` (Agent harness section).
- **Status**: active

### D-2026-09-30-1 · Collections respect household visibility

- **Decision**: a recipe added to a collection renders for household members if the
  recipe is household-visible. Adding a recipe the caller cannot read returns `404`.
- **Why**: consistent with household-shared recipes (sharing epic). Was left open in #125
  for owner confirmation; the owner confirmed by approving the merge.
- **Where it lives**: `packages/api/src/routes/taxonomy.ts` (`getVisibleOwnerIds`), PR #125.
- **Status**: active

### D-2026-09-30-2 · React / React Native move only with the Expo SDK

- **Decision**: `react`, `react-dom`, `@types/react*` and `react-native` are pinned with
  `~` ranges and Dependabot ignores their minor bumps. They are only upgraded via
  `npx expo install` together with an Expo SDK bump.
- **Why**: Dependabot bumped RN 0.86 → 0.87 and React 19.2 → 19.3 outside the SDK, which
  broke `expo export` (`rn-get-polyfills` not exported).
- **Where it lives**: `.github/dependabot.yml` (ignore list), `apps/app/package.json`, PR #147.
  Scope extended on 2026-09-30 (audit) to `babel-preset-expo`, `jest-expo` and
  `@react-native/*`, which are SDK-pinned too.
- **Status**: active. Known drift: Expo 56 expects RN `0.85.3` / React `19.2.3`, the repo
  runs RN `0.86.x` / React `19.2.8` (drifted before this session; builds and E2E are
  green). Revisit on the next Expo SDK upgrade.

### D-2026-09-30-3 · `image-size` advisories accepted

- **Decision**: GHSA-5p2g-fcmc-qvqq and GHSA-w3rx-r6r6-pgpr are ignored in
  `pnpm.auditConfig.ignoreGhsas`. All other high advisories must be fixed.
- **Why**: only reached through metro 0.84 at build time, which needs the 1.x API; it
  parses the app's own bundled assets, so the DoS is not reachable from user input.
- **Where it lives**: root `package.json`, PR #148.
- **Status**: superseded 2026-09-30 — `image-size` had already left the tree via metro
  0.84.5 (#147) when this was recorded; the `ignoreGhsas` entries were removed.

### D-2026-09-30-4 · Vitest 4 and coverage ignore hints

- **Decision**: the repo runs Vitest 4 with `@vitest/coverage-v8` 4. Coverage exclusions
  use `/* v8 ignore start */ … /* v8 ignore stop */` or `/* v8 ignore next */`; the
  `next N` form is not supported anymore and must not be used.
- **Why**: Vitest 4 silently ignores `next N`, and an unclosed `start` excluded the rest of
  `households.ts`. The AST-aware remapping also counts branches v3 missed; they were
  covered with tests rather than lowering thresholds.
- **Where it lives**: `packages/*/vitest.config.ts`, PR #140. Three leftover `next N`
  hints in `packages/api/src/db/` were converted on 2026-09-30 (audit).
- **Status**: active

### D-2026-09-30-5 · Release 0.3.1

- **Decision**: all packages released as 0.3.1 via release-please after the above merged.
- **Where it lives**: PR #124, `CHANGELOG.md` files.
- **Status**: active
