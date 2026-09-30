# Decision log

Lightweight, append-only record of decisions taken in working sessions (with the
owner or an agent) that are too small for an ADR but must not live only in a chat.
Big architectural choices still get an ADR in `docs/adr/`; link it from here.

The "Auditar" skill (persona 12, planning & decisions sync) reads this file and checks
each entry against the code, the ADRs, `CLAUDE.md` and the Notion roadmap.

**How to add an entry**: newest first. One entry per decision. Keep the fields below;
`Status` is `active`, `superseded by <link>` or `revisit when <condition>`.

---

## 2026-09-30 — Dependency & maintenance session (PRs #125, #140, #147, #148, #124)

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
- **Status**: active. Invitees still need an in-app way to accept (backlog story
  "accept/decline invitations in the app").

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
