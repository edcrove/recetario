# Decision log

Lightweight, append-only record of decisions taken in working sessions (with the
owner or an agent) that are too small for an ADR but must not live only in a chat.
Big architectural choices still get an ADR in `docs/adr/`; link it from here.

The "Auditar" skill (persona 12, planning & decisions sync) reads this file and checks
each entry against the code, the ADRs, `CLAUDE.md` and the Notion roadmap.

**How to add an entry**: newest first. One entry per decision. Keep the fields below;
`Status` is `active`, `superseded by <link>` or `revisit when <condition>`.

---

## 2026-10-03 — Security workflow

### D-2026-10-03-2 · Acknowledge GHSA-vfj7-8cjw-p6xm (braces) until a fix ships

- **Decision**: `pnpm.auditConfig.ignoreGhsas` also lists GHSA-vfj7-8cjw-p6xm, so
  `pnpm audit --audit-level=high` passes. Any other high or critical advisory still fails it.
- **Why**: the advisory (stack exhaustion on deeply nested brace patterns) affects
  `braces <=3.0.3` and no patched version exists (3.0.3 is the latest on npm). It reaches us
  only through `expo > @expo/cli > metro > metro-file-map > micromatch`, which expands the
  build's own glob patterns at bundle time; no user input reaches it, and the module is not in
  the web bundle or the api/mcp builds.
- **Where it lives**: root `package.json` (`pnpm.auditConfig`), `.github/workflows/security.yml`.
- **Status**: revisit when `braces` (or `micromatch`) publishes a fixed version: remove the
  ignore in the same PR that takes the fix.

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

### D-2026-10-01-5 · Day and week nutrition are per-person intake

- **Decision**: the day rollup (`computeDayNutrition`), the week view
  (`GET /v1/menu/nutrition`) and suggestion `goalFit` count **one portion per planned
  dish** — the intake of the person whose targets they are compared against — instead of
  per-serving nutrition × planned servings.
- **Why**: targets are personal; a family of 4 planning a 600 kcal dinner showed 2400 kcal
  against one adult's goal, so deltas and `goalFit` were inflated ~N×. Planned servings
  still drive the shopping list and scaling, not intake.
- **Where it lives**: `packages/shared/src/dayNutrition.ts`, `routes/menu.ts`,
  `DayNutritionSummary` ("Por persona"), MCP `getDayNutrition` description. Both views read
  the same household-shared entries through `menuRepository.getNutritionInputs` and the
  same `computeDayNutrition` rollup (2026-10-01 audit: the week used only the caller's own
  entries).
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

### D-2026-10-01-8 · Capture cook-time context now

- **Decision**: each cook session stores the servings cooked, where it was logged from
  (`app` / `mcp`) and a snapshot of the recipe's per-serving nutrition; users record
  `last_login_at` on password login.
- **Why**: none of this can be reconstructed later (2026-10-01 audit, Data Science), and
  capturing it before production data exists is free.
- **Where it lives**: migration `0016`, `cook-sessions-repository.ts`, `POST /v1/cook-sessions`
  (`servings`, `source`), `/auth/login`, cook mode, MCP `logCookSession`.
- **Status**: active — menu-entry status (planned/cooked/skipped instead of hard deletes) is
  still open.

### D-2026-10-01-9 · Instants are timestamptz; calendar days are date; profiles keep the device zone

- **Decision**: every timestamp column is `timestamp with time zone` (existing values read as
  UTC, which is what `now()` wrote); `menu_entries.date` and `shopping_list_checks.week_start`
  are `date` (still strings in code), and so is `pantry_items.expiry_date`. The app stores the device's IANA zone on the profile
  while it is the UTC default, never overwriting one set on purpose; the API rejects
  unknown zones.
- **Why**: 2026-10-01 audit (Data) — naive timestamps and text dates are cheapest to fix
  before production data, and "today"/week math needs the user's zone.
- **Where it lives**: migration `0017` (custom: drizzle can't cast text→date without
  `USING`) + `0018` (generated, defaults); `0020` (custom) + `0021` (generated) for the
  pantry expiry date; `useTimezoneSync`, `PATCH /auth/profile`.
- **Status**: active

### D-2026-10-01-10 · Planned dishes have a status

- **Decision**: menu entries carry `status` (`planned` | `cooked` | `skipped`, default
  `planned`). Marking a dish skipped keeps it as history and leaves it out of the day's and
  week's intake; cooked and planned still count. Removing an entry stays an explicit delete.
  The shopping list ignores status (what to buy doesn't change once a dish is skipped).
- **Why**: 2026-10-01 audit (Data) — hard deletes were the only way to record "we didn't
  make it", so plan-vs-actual could never be analyzed.
- **Where it lives**: migration `0019`, `MenuEntryStatusSchema`, `PATCH /v1/menu/{date}/{slot}/{recipeId}`
  (`servings` and/or `status`), MCP `updateMenuEntry`, the planner's edit modal.
- **Status**: active — D-2026-10-01-8's note on menu-entry status is resolved by this.

### D-2026-10-01-11 · E2E waits: one timeout budget, flakes fail CI

- **Decision**: Playwright sets `expect`, `toPass`, action and navigation timeouts once in
  `playwright.config.ts`; specs pass a timeout only for steps known to be slower. No
  `networkidle` waits (the visual tour keeps one settle pause for screenshots). CI keeps one
  retry but `failOnFlakyTests` fails the run when a test only passes on retry.
- **Why**: 2026-10-01 audit (QA automation) — 375 per-call timeouts, `networkidle` (which an
  SPA with polling never reaches reliably) and retries that turned flakes green.
- **Where it lives**: `apps/app/playwright.config.ts`, `apps/app/e2e/*.spec.ts`.
- **Status**: active

### D-2026-10-01-12 · Household visibility is resolved in the repositories

- **Decision**: routes never compute the household-visible owner set. Recipe reads take an
  explicit `RecipeScope`: `{ visibleTo: callerId }` (caller plus accepted housemates,
  resolved inside the repository like menu, pantry and cook sessions already did) or
  `{ ownedBy: ownerId }` for strict guards ahead of a write. Route files go through
  repositories for every table (account, taxonomy, config, household repositories).
- **Why**: 2026-10-01 audit (Clean code) — visibility was resolved in two layers and a
  `string | string[]` owner argument made the strict/visible choice implicit.
- **Where it lives**: `packages/api/src/db/repository.ts` (`RecipeScope`), `src/db/*-repository.ts`.
- **Status**: active

### D-2026-10-01-13 · Household roles: who changes them, who can leave

- **Decision**: the owner and accepted admins can change any non-owner member's role
  (`PATCH /v1/households/{id}/members/{userId}`, same rights as invite/remove). The owner's
  role never changes, and nobody can be promoted to owner. Any accepted non-owner member
  can leave (`POST /v1/households/{id}/leave`). The owner can't leave (409), because
  ownership transfer isn't built. A pending invitee declines instead of leaving.
- **Why**: AC of the story "App: gestión de household" (owner changes role, member leaves),
  found unimplemented by the 2026-10-01 test-base review. Keeping one manage-rights rule
  (owner/admin) avoids a third permission tier.
- **Where it lives**: `packages/api/src/routes/households.ts`, `household-repository.ts`,
  MCP `changeHouseholdMemberRole` / `leaveHousehold`, `apps/app/app/household/index.tsx`.
- **Status**: active · revisit when ownership transfer is built

### D-2026-10-01-14 · Cooking streak: local days, alive until a full day is missed

- **Decision**: the stats streak counts consecutive calendar days with at least one cook
  session, in the profile's time zone (a 23:30 dinner in Montevideo is that day). A streak
  that reached yesterday is still current today, because there is still time to cook. It
  breaks only after a whole day with no cooking. `longest` is the best run in all history.
  Neither figure is limited by the stats `since` window. Owners without a profile use UTC.
- **Why**: AC of the story "App: pantalla de stats y tendencias" ("streak de días
  consecutivos cocinando"), found unbuilt by the 2026-10-01 test-base review. Showing 0
  every morning before cooking would read as a broken streak.
- **Where it lives**: `packages/shared/src/cookStreak.ts`, `cookSessionsRepository.cookDays`,
  `GET /v1/cook-sessions/stats` (`streak`), `apps/app/app/stats/index.tsx`.
- **Status**: active

### D-2026-10-01-15 · Taxonomy badge lists its recipes; items are created per tab

- **Decision**: `GET /v1/config/{type}/{id}/recipes` returns the caller's recipes behind an
  item's usage badge, matched exactly as the overview counts them, so the list always has
  as many rows as the badge. `POST /v1/config/{type}` creates the caller's own category,
  food type or tag. A name whose slug is already visible to the caller (system or own) is a
  409; a name with no slug characters is a 400. The MCP `getTaxonomyUsage` tool now returns
  that list instead of only the count, and `createTaxonomyItem` was added.
- **Why**: configurator ACs ("tap en badge → ver recetas que lo usan", "crear nuevo ítem en
  cada tab") found unbuilt by the 2026-10-01 test-base review.
- **Where it lives**: `configRepository.create` / `usedBy`, `packages/api/src/routes/config.ts`,
  `packages/mcp/src/tools/configurator.ts`, `apps/app/app/config/index.tsx`.
- **Status**: active. Known gaps found here: recipe tags never reached `recipe_tags` (fixed by
  D-2026-10-02-1); recipe categories were a fixed enum (fixed by D-2026-10-02-2).

### D-2026-10-02-1 · A recipe's tags feed each owner's tag registry

- **Decision**: a recipe's `tags` list stays the field people and agents read, write and search
  by. Every recipe create, update or copy links it to the owner's tags (`tags` +
  `recipe_tags`), creating the tags it doesn't have yet. Spellings with the same slug share
  one tag, and the first spelling names it. A tag with no slug characters stays on the recipe
  but isn't registered. The configurator writes back: renaming a tag renames it on its
  recipes; deleting removes it; merging, or deleting with reassignment, swaps it for the
  target's name, without duplicates. The release step links recipes saved before this
  (idempotent).
- **Why**: latent bug found by D-2026-10-01-15. Nothing wrote `recipe_tags`, so tag badges
  were always 0 and rename/merge/delete never touched real recipes.
- **Where it lives**: `packages/api/src/db/recipe-tags.ts`, `slug.ts`,
  `configRepository` (tag rename/delete/merge), `RecipeRepository.create`/`update`,
  `scripts/release.ts`.
- **Status**: active

### D-2026-10-02-2 · Recipes can use custom categories

- **Decision**: a recipe's `category` is a name, no longer a fixed list. The API accepts a system
  category or one of the owner's own, matched by slug ("comida rápida" stores "Comida
  rápida"). An unknown name, or someone else's, is a 400 `Unknown category`. A copy of someone
  else's recipe in a category the copier doesn't have is filed under `Otro`. Recipes match their
  category row through the same slug, computed in SQL, so multi-word and accented names count.
  Renaming a custom category renames it on the owner's recipes. The recipe form offers the
  system categories, then the owner's own, sharing the configurator's `config-taxonomy` cache.
- **Why**: latent bug found by D-2026-10-01-15. `CategorySchema` was an enum, so a category
  created in the configurator could never be used; and `lower(category) = slug` never matched
  names with spaces or accents, even after a delete with reassignment.
- **Where it lives**: `@recetario/shared` `CategorySchema`/`SYSTEM_CATEGORIES`,
  `RecipeRepository.usableCategory`, `configRepository` (`categorySlug`, category rename),
  `apps/app/src/utils/recipeForm.ts` `categoryOptions`, `RecipeForm`, MCP `CategoryInput`.
- **Status**: active

### D-2026-10-02-3 · Tests never rebuild a package other tests are reading

- **Decision**: `@recetario/api` no longer has a `pretest` that rebuilt `@recetario/shared`.
  `turbo run test` already builds `shared` first (`test.dependsOn: ["^build"]`), so the only
  effect of that `pretest` was to rewrite `shared/dist` again, with `tsc`, while the `mcp` and
  `app` tests were already importing it.
- **Why**: CI on #227 failed in `mcp` with `NutritionTargetsSchema` undefined at import time: it
  read a `schema.js` being rewritten. Watching `shared/dist` during `turbo run test` showed the
  rewrite landing while `mcp` and `app` tests ran; without the `pretest` it no longer happens.
- **Where it lives**: `packages/api/package.json`, `turbo.json`.
- **Status**: active. Running only the api tests directly (outside turbo) needs `shared` built
  first (`pnpm --filter @recetario/shared build`), like `ci:local` does.

### D-2026-10-02-4 · Acknowledge GHSA-86w9-cpqp-85rv (node-forge) until a fix ships

- **Decision**: `pnpm.auditConfig.ignoreGhsas` lists GHSA-86w9-cpqp-85rv, so the Security
  workflow's `pnpm audit --audit-level=high` passes again. Nothing else is ignored, so any other
  high or critical advisory still fails it.
- **Why**: the advisory (RSA PKCS#1 v1.5 signature verification accepts extra nested
  DigestAlgorithm elements) affects `node-forge <=1.4.0`, and no patched version exists (1.4.0 is
  the latest on npm). It reaches us only through `expo > @expo/cli`, which uses it for iOS code
  signing (`expo run:ios`) and expo-updates signing certificates. We use neither, and it isn't in
  the web bundle or in the api/mcp builds (no `node-forge` in `apps/app/dist*` or `packages/*/dist`).
  Leaving the check red on every PR hid any new high advisory.
- **Where it lives**: root `package.json` (`pnpm.auditConfig`), `.github/workflows/security.yml`.
- **Status**: revisit when `node-forge` publishes a fixed version (Dependabot will propose it):
  remove the ignore in the same PR that takes the fix.

### D-2026-10-02-6 · Deleting a recipe unplans its upcoming dishes

- **Decision**: deleting a recipe removes its menu entries that are still `planned` and dated
  today or later. Past entries, and cooked or skipped ones, stay as history with their title
  snapshot (the 2026-07-03 audit rule for history is unchanged). The confirmation reads
  "También se quita de los próximos menús y de tus colecciones."
- **Why**: the confirmation promised the recipe left the menu, but every entry stayed as an
  "(eliminada)" chip with no way to remove it from the planner.
- **Where it lives**: `RecipeRepository.delete`, `cascade-delete.integration.test.ts`,
  `app/recipe/[id].tsx`.
- **Status**: active

### D-2026-10-02-5 · A housemate's planned dish is read-only in the planner

- **Decision**: the week view keeps showing every housemate's dishes, but only your own get the
  edit modal and the ✕; a housemate's chip is disabled. The modal's "Eliminar del menú" now
  asks first like the ✕ does.
- **Why**: menu writes are owner-scoped in the API, so those buttons always failed with
  "No se pudo quitar…". Letting members edit each other's dishes would change the API's
  write rule; that stays a product call, not a bug fix.
- **Where it lives**: `apps/app/app/menu/index.tsx` (`canEdit`), `e2e/household-menu.spec.ts`.
- **Status**: revisit when households want a jointly edited menu.

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
