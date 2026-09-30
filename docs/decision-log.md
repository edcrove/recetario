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
- **Status**: active. Known drift: Expo 56 expects RN `0.85.3` / React `19.2.3`, the repo
  runs RN `0.86.x` / React `19.2.8` (drifted before this session; builds and E2E are
  green). Revisit on the next Expo SDK upgrade.

### D-2026-09-30-3 · `image-size` advisories accepted

- **Decision**: GHSA-5p2g-fcmc-qvqq and GHSA-w3rx-r6r6-pgpr are ignored in
  `pnpm.auditConfig.ignoreGhsas`. All other high advisories must be fixed.
- **Why**: only reached through metro 0.84 at build time, which needs the 1.x API; it
  parses the app's own bundled assets, so the DoS is not reachable from user input.
- **Where it lives**: root `package.json`, PR #148.
- **Status**: revisit when Expo/metro depend on `image-size` ≥ 2.0.3 (then remove the ignore).

### D-2026-09-30-4 · Vitest 4 and coverage ignore hints

- **Decision**: the repo runs Vitest 4 with `@vitest/coverage-v8` 4. Coverage exclusions
  use `/* v8 ignore start */ … /* v8 ignore stop */` or `/* v8 ignore next */`; the
  `next N` form is not supported anymore and must not be used.
- **Why**: Vitest 4 silently ignores `next N`, and an unclosed `start` excluded the rest of
  `households.ts`. The AST-aware remapping also counts branches v3 missed; they were
  covered with tests rather than lowering thresholds.
- **Where it lives**: `packages/*/vitest.config.ts`, PR #140.
- **Status**: active

### D-2026-09-30-5 · Release 0.3.1

- **Decision**: all packages released as 0.3.1 via release-please after the above merged.
- **Where it lives**: PR #124, `CHANGELOG.md` files.
- **Status**: active
