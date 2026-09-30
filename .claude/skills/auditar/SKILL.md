---
name: auditar
description: Full-project multi-agent audit of Recetario. Launches 12 specialized agents in parallel (QA, Backend, Frontend, UX/UI, Nutrition, Parent/family user, Read-only user, Product Management, Data Science, Clean Code/Architecture, QA Automation Architecture, Planning & decisions sync), each reviewing the codebase and tests from their own expertise, then consolidates findings into a deduplicated, prioritized report and creates Notion backlog entries for real issues. Use when the user says "Auditar" (as a standalone message or a request to run a project audit). Not for single-feature reviews — this is a whole-project pass, expensive and meant to be run periodically (e.g. before a release), not per-PR.
user-invocable: true
effort: high
---

# Auditar — multi-agent project audit for Recetario

Twelve agents, each with their own expertise and none aware of the others' findings, review
the Recetario codebase in parallel and report back independently. The point of running
them in parallel with no shared context is that they don't anchor on each other — a UX
finding and a Backend finding about the same broken flow (like the `foodTypeIds` /
`Alert.alert` bugs found in the 2026-07-02 session) are more likely to surface
independently this way than if one agent read the others' notes first.

## When this runs

Triggered by the user typing "Auditar" (exact word, case-insensitive, as its own message
or within a request like "Auditar el proyecto"). Also invocable explicitly as `/auditar`.

This is a **heavy, deliberate operation** — expect 10-20 minutes and significant token
spend across 12 parallel agents. Don't run it speculatively; only when the user asks.

## Prerequisites check (do this before spawning agents)

1. Confirm `docker compose up -d` (or the dev servers) can start — several agents need to
   exercise the running app/API, not just read source. If Docker/Postgres isn't available,
   tell agents to note it and rely on static analysis + existing test output instead of
   skipping their whole review.
2. Run `pnpm --filter @recetario/api test 2>&1 | tail -5`, `pnpm --filter recetario-app test 2>&1 | tail -5`,
   and check whether the E2E suite (`apps/app/e2e/`) is currently green — this baseline
   goes into every agent's prompt so they don't waste time re-discovering "tests pass."
3. Check `git status` — if there are uncommitted changes, ask the user whether to audit
   the working tree as-is or ask them to commit/stash first. Note whichever they choose in
   the final report.
4. **Capture the front-end regression screenshots** (input for persona 1, also shared
   with personas 4, 6 and 7). Use the first source that works and note which one in the
   report:
   - **Local E2E stack** (Docker available): `E2E_SCREENSHOTS=true pnpm e2e:local`.
   - **CI artifact** (no Docker, e.g. cloud sessions): download the `e2e-screenshots`
     artifact of the latest green CI run on `main` (GitHub MCP `actions_list` →
     `list_workflow_run_artifacts` → `actions_get download_workflow_run_artifact`).
   - **No-Docker local run**: start Postgres, build + migrate + seed the API, start it,
     `seed:e2e-accounts`, `pnpm --filter recetario-app build`, `npx serve -s dist`,
     then `E2E_SCREENSHOTS=true PLAYWRIGHT_BASE_URL=… EXPO_PUBLIC_API_URL=… npx
playwright test` (if the bundled browser version doesn't match, pass a throwaway
     config with `launchOptions.executablePath`; never commit it).

   Output: `apps/app/test-results/**/test-finished-*.png` (final state of every
   regression test, named by test) and `apps/app/test-results/visual-tour/` (every
   screen × phone/desktop × light/dark). Pass the absolute paths in the agents' prompts.

## Launching the 12 agents

**Single message, 12 parallel `Agent` tool calls.** Use the repo's read-only agent
types, which set the reasoning effort per persona (the `Agent` tool has no per-call
effort parameter):

- `subagent_type: audit-deep` (effort `high`): personas 1, 2, 3, 5, 10, 11, 12 — they
  trace code across files and must get correctness/security/drift right.
- `subagent_type: audit-persona` (effort `medium`): personas 4, 6, 7, 8, 9 — they judge
  flows and product fit; more effort adds cost, not findings.

The orchestrator itself runs at `high` (skill frontmatter) because deduplicating and
prioritizing 12 reports is the step where judgement matters most.

Both agent types use `model: inherit`, so every persona runs on the session's model —
don't pass `model` in the call. Pass a cheaper alias (e.g. `"sonnet"`) only when the user
explicitly asks for a lighter/cheaper pass. Both types also block file edits and Notion
writes; only the orchestrator writes to Notion, during consolidation.

Agents run in the background and the harness notifies you when each one finishes: do
not poll, sleep or re-launch while they run, and do not start consolidating until all
12 have reported. If one has not reported after a long time, check on it once
(`SendMessage` / its status) before re-running it with a narrower scope — the
2026-07-03 hangs below came from very broad scopes, not from the prompt.

Each agent gets:

- The persona prompt from the table below (verbatim intent, adapt file paths if the repo
  structure has changed)
- The baseline test/coverage numbers from the prerequisites step
- An explicit instruction: **read-only investigation, do not modify any files**. If an
  agent thinks something needs fixing, it reports it — it does not fix it.
- An explicit output format (see "Expected output shape" below) so consolidation is
  mechanical, not another round of interpretation

### The 12 personas

| #   | Persona                                     | Scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **QA / Software testing expert**            | **Visual regression review (required):** open every screenshot from prerequisite 4 (Read tool on each PNG — the visual tour first, then the per-test final states) and report (a) aesthetic issues: misalignment, inconsistent spacing, clipped/overflowing or truncated text, low contrast, dark-mode elements that stay light (or the reverse), broken or missing images/icons, layout that breaks at phone width; (b) design-consistency issues: colors, typography, button/chip styles or header treatment that differ between screens for the same role; (c) workflow issues: a test's final state that shows no confirmation/feedback, an error or empty state where content was expected, dead ends, or a screen that is unreachable/blank. Cite the screenshot file name as evidence and, when you can, the component/screen file. Then: Testing pyramid completeness (unit/integration/E2E) across `packages/api`, `packages/mcp`, `packages/shared`, `apps/app`. Coverage gaps vs the 100%/98% thresholds in `CLAUDE.md`. Flaky or order-dependent tests. Missing edge cases (error paths, boundary values, race conditions). Whether `e2e/*.spec.ts` actually assert meaningful behavior vs just "element visible." Cross-reference `apps/app/coverage-e2e/coverage-summary.json` if present. |
| 2   | **Backend engineering expert**              | `packages/api` — Hono route design, Zod schema validation completeness, Drizzle schema/migrations correctness, auth middleware (`src/middleware/auth.ts`), SQL injection / authz gaps (does every route filter by `ownerId`?), N+1 queries, error handling consistency, `packages/mcp` tool correctness vs the API it wraps.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 3   | **Frontend engineering expert**             | `apps/app` — React Native / Expo Router structure, component decomposition, state management (React Query usage, stale-data bugs), performance (unnecessary re-renders, missing memoization), React Native Web compatibility gaps (the `Alert.alert` no-op class of bug — check for `Vibration`, `Share`, `Clipboard`, `Linking`, other RN APIs that may not work on web), TypeScript strictness violations.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 4   | **UX/UI expert**                            | Navigation flow friction, error message clarity and actionability, empty-state quality, loading-state consistency, visual consistency (spacing/colors/typography drift across screens), mobile ergonomics (tap target sizes, one-handed use), whether destructive actions (delete recipe, remove household member) have adequate confirmation. Actually navigate the running app (docker compose, localhost:8080) rather than just reading JSX. If the app isn't running, use the screenshots from prerequisite 4 instead of JSX alone.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 5   | **Nutrition domain expert**                 | Accuracy of the nutrition data model (`packages/shared/src/schema.ts` — `NutritionSchema`, `DietaryTagSchema`), whether macro scaling math is nutritionally sound, allergen-detection logic in `AllergenWarning.tsx` (string-matching ingredient names against allergens — false positive/negative risk), whether nutrition targets (`NutritionTargetsSchema`) reflect real dietary guidance ranges, unit conversion correctness for nutrition-relevant units.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 6   | **Persona: parent/family user**             | Actually use the running app (or read screens+flows if it's not up) as a parent planning a week of family meals: creating/editing recipes, weekly menu with multiple dishes per slot, shopping list usefulness, dealing with a kid's allergy via dietary filters. Report friction in plain language, not engineering terms — what would make them give up or complain.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 7   | **Persona: read-only / non-organizer user** | Someone who mostly _consumes_ recipes rather than creating or planning — browsing, cooking from someone else's recipe, rating it afterward. Is there a good "browse and discover" experience? Does cook mode work well for someone unfamiliar with the app? Is there friction if they never touch the menu-planning or collections features at all?                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 8   | **Product management expert**               | Feature completeness vs the Notion backlog and roadmap phases (fetch `https://app.notion.com/p/3d20a1ab4ba245bca87a2aaa11c4b278` for current state). Half-built features (cross-reference the `foodTypeIds`/`recipe_food_types` and `useSuggestions.ts` findings from 2026-07-02 — are there others in the same "UI exists, backend doesn't" or "built, never wired in" shape?). MVP readiness for a "1.0" release. Backlog hygiene (duplicate stories, stale statuses).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 9   | **Data science / analytics expert**         | What data is currently being captured (cook sessions, ratings, nutrition, menu history) and what's collectible but unused. What analytics or ML use cases this unlocks (popular recipes, seasonal trends, personalized suggestions — note `useSuggestions.ts` already half-builds this). Data quality issues that would block analysis (nulls, inconsistent units, missing timestamps). Whether current schema/instrumentation is analytics-friendly or would need backfilling.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 10  | **Clean code / architecture expert**        | Code smells across all 4 packages: duplication, long functions/files, unclear naming, leaky abstractions, inconsistent patterns between similar modules (e.g. route files, MCP tools, screens). Module boundaries and dependency direction (does `packages/shared` stay dependency-free of api/app? does `apps/app` reach into `packages/api` internals instead of the REST client?). Whether the repo's own stated conventions (CLAUDE.md) are actually followed in practice, not just documented. SOLID/DRY violations worth calling out concretely with file:line, not abstractly.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 11  | **QA automation architecture expert**       | Structure of the Playwright E2E suite as a codebase in its own right (not test coverage numbers — that's persona 1's job): fixture design (`e2e/fixtures.ts`, `e2e/demoAccounts.ts`), selector strategy consistency (testID vs text), how much duplication exists across `*.spec.ts` files for common flows (login, navigation, opening a modal). Specifically evaluate whether a **Page Object Model** (or a lighter equivalent — helper modules per screen) would reduce duplication and fragility, and if so sketch what it would look like for 2-3 real screens as a concrete example. Compare against how the project's own testing-pyramid conventions in `CLAUDE.md` describe E2E tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 12  | **Planning & decisions sync**               | Checks that the plan, what is built and the decisions taken are the same story. Sources: the Notion roadmap/backlog (`https://app.notion.com/p/3d20a1ab4ba245bca87a2aaa11c4b278`) and ADRs in Notion; `docs/adr/*.md`; `docs/decision-log.md` (decisions from working sessions); `CLAUDE.md`; `CHANGELOG.md` files; `git log` and merged/open PRs since the last audit (see Audit history). Look for: stories marked Done/In review with no merged code, or merged work whose story is still Backlog/In progress; ADRs whose decision is not reflected in the code or config (e.g. an accepted deployment ADR with no deploy config), or code that contradicts an ADR; `docs/adr/` mirror out of sync with Notion; every `docs/decision-log.md` entry still `active` actually holding in code/config, and `revisit when …` entries whose condition is now met; facts in `CLAUDE.md` that no longer match reality (versions, thresholds, commands, package list); decisions visible in merged PR descriptions that were never recorded in the log or an ADR. Classify each drift as _plan behind code_, _code behind plan_ or _undocumented decision_, and say which side should be updated.                                                                                                              |

### Expected output shape (put this in every agent's prompt verbatim)

```
Report back in this exact structure:

## Findings

For each finding:
- **Title** (one line)
- **Severity**: P0 (blocks release / data loss / security) | P1 (broken user-facing
  feature) | P2 (quality/completeness gap) | P3 (nice-to-have / polish)
- **Evidence**: file:line, command output, or screen/flow description
- **Recommendation**: one or two sentences, concrete

## Summary

3-5 sentences: overall health from your lens, the single most important thing to fix.

Do not modify any files. Do not fix anything — only investigate and report. If something
needs live app access and it isn't running, say so explicitly rather than guessing from
source alone.
```

## Consolidating results

After all 12 agents return (they run in parallel — wait for all before consolidating, do
not start writing the report as each one trickles in):

1. **Merge findings across all reports.** Expect real overlap (e.g. the UX agent and the
   parent-persona agent both flagging the same confusing menu flow) — that's a signal, not
   noise; note when 2+ agents independently hit the same issue.
2. **Deduplicate** exact repeats (same file, same root cause) into one entry, citing which
   personas raised it.
3. **Sort by severity** (P0 first), then by how many personas independently flagged it.
4. **For each P0/P1 finding**, check whether a Notion entry already exists (search
   the backlog first — see `project_sdlc_rules` memory) before creating a new one. Use the
   same Bug/Story/Task conventions as the rest of the project (Priority, Area, Acceptance
   criteria, Definition of Done) — follow the pattern from the 2026-07-02 session's bug
   entries (`https://app.notion.com/p/39164048cc358141a957ecb6eff3b916` etc.) as the
   template for structure and tone.
5. **P2/P3 findings** go into a single consolidated "Audit backlog" Notion page (create one
   if it doesn't exist) rather than as individual stories — link out from there instead of
   flooding the board.
6. **Planning drift (persona 12)** is not filed as bugs. List each drift item in the
   report with the side that should change. Do not edit Notion statuses, ADRs or
   `CLAUDE.md` on your own: propose the updates and apply them only after the user
   confirms. Record any decision the user takes while resolving drift in
   `docs/decision-log.md`.
7. **Write the final report** as a markdown summary for the user: total findings by
   severity, the P0/P1 list with links to the Notion entries just created, a short
   per-persona highlight (one sentence each), and the single top recommendation across all
   lenses combined, plus the planning-sync verdict from persona 12 (in sync / drifted, and the
   top drift items).

## Notes for next time

- If a persona's scope needs adjusting (e.g. the app gained a new domain like grocery
  delivery integration), edit the table above — don't just improvise a different persona
  ad hoc, keep this file as the source of truth so audits are comparable over time.
- Keep a light-touch history: after each full audit, add one line to this file's bottom
  noting the date and the single biggest finding, so a future audit can check "did we fix
  what we found last time."

### Audit history

<!-- Append one line per completed audit run, most recent first -->

- **2026-09-30**: first 12-persona run (new: Planning & decisions sync, visual screenshots reviewed by QA, per-persona effort via `audit-deep`/`audit-persona`). No Docker and the proxy blocked the CI screenshot artifact, so the full regression + visual tour ran on a no-Docker local stack (281 screenshots); local Postgres in the scratchpad died mid-run (permissions reset) — keep it under `/var/lib/postgresql`. No agent hung. Biggest findings (both confirmed live): household visibility ignored invite acceptance (inviting any email exposed both users' private data) and Zod 4 defaults in `UpdateRecipeSchema` made every partial MCP update wipe steps/tags/images. 2 P0 + 17 P1 filed; P2/P3 in [Audit backlog — 2026-09-30](https://app.notion.com/p/3eb64048cc3581788383f0e375afb02f). Several 2026-07-03 P2s still open (allergen matching, error contract, stats UUIDs).
- **2026-07-03 (follow-up, personas 10-11 only)**: user asked for a supplementary pass with the 2 newly-added personas (Clean Code/Architecture, QA Automation Architecture). Both background agents hung too — this makes 3 of 3 long solo background-agent runs hanging in this session, a strong signal this is a real environment limitation, not chance. QA Automation Architecture finished fine on its first try (13 tool calls, ~106s) when given tight "combine calls" instructions and a narrower scope — Clean Code/Architecture with a broader scope still hung despite the same instructions. **Takeaway for next time**: narrower persona scope seems to correlate with not hanging more than the efficiency instructions do — consider splitting broad personas (whole-monorepo code review) into smaller ones (per-package) if this keeps happening. Biggest finding: QA persona gave a concrete verdict that a lightweight helper-module pattern (not class-based POM) is worth adopting for the E2E suite, with a full code sketch for 3 screens — filed as its own Chore rather than buried in the P2/P3 page since it's directly actionable.
- **2026-07-03**: 9 personas run (Backend and Product Management had to be done directly by the orchestrator after their background agents hung twice each — a real limitation of very long-running `local_agent` background tasks in this environment, not a prompt issue; worth trying `model: "haiku"` or splitting scope smaller next time if it recurs). Biggest finding: an IDOR in the taxonomy configurator (`config.ts`) with zero ownerId checks on rename/delete/merge, plus a triple-confirmed root cause (Nutrition, Data Science, parent-persona) that MCP's `createRecipe`/`updateRecipe` never expose `nutrition`/`dietaryTags`, so no recipe created through the real agent write path can ever have trustworthy allergy data. See [Audit backlog — 2026-07-03](https://app.notion.com/p/39264048cc3581ef92d8e7bff20a96c5) for P2/P3, and the 9 new Bug/Story entries created the same day for P0/P1.
