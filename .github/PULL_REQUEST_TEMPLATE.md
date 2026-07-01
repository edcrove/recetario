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
- [ ] New routes/functions have tests maintaining 100% coverage
- [ ] **App UI**: all user-visible text is in Spanish (labels, placeholders, error messages, buttons, alerts)
- [ ] **CORS**: if new API middleware added, verified that preflight and `Origin` header responses work
- [ ] **Local smoke test**: ran the app locally and verified the golden path end-to-end
- [ ] **Dependabot**: if Dependabot security alerts are open, address or acknowledge them before merging
