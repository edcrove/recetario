## What does this PR do?

<!-- Clear and concise description. One sentence per bullet. -->

-

## Motivation

<!-- Why is this necessary? What problem does it solve? Link to story/bug. -->

## Key changes

<!-- Key files/components modified and what changed in them. -->

-

## Evidence

### ✅ Local CI (`pnpm ci:local`)

<!-- Paste the test output summary from the pre-push hook or `pnpm ci:local` -->

```
Test Files:  X passed (Y files)
Tests:       X passed
Coverage:    X% statements, X% branches
Build:       success
```

### 🧪 Test output per package

<!-- Paste relevant test output, especially for new test files -->

```

```

## Notion

<!-- Direct link to the story: https://app.notion.com/p/... -->

## Checklist

- [ ] `pnpm ci:local` passed without errors
- [ ] No debug `console.log` or unnecessary `any`
- [ ] No ESLint warnings (CI runs with `--max-warnings=0`)
- [ ] Notion story → "In review" with link to this PR
- [ ] DB migration included if schema changed

### Testing pyramid (every applicable layer must be covered)

- [ ] **Unit tests** — new logic, utils, MCP tools: 100% coverage
- [ ] **API route tests** — new endpoints: 200 / 400 / 401 / 404 cases
- [ ] **Integration tests** — DB constraints, multi-step flows (if touching DB)
- [ ] **Screen tests** — new app screens with non-trivial logic (jsdom)
- [ ] **E2E (Playwright)** — at least 1 smoke test for each new user-facing screen

### Quality gates

- [ ] **App UI**: all user-visible text is in Spanish (labels, placeholders, error messages, buttons, alerts)
- [ ] **CORS**: if new API middleware added, verified preflight and `Origin` header work
- [ ] **Local smoke test**: ran `docker compose up -d` and verified the golden path end-to-end
- [ ] **Dependabot**: no open high-severity security alerts before merging
