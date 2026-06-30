#!/bin/bash
# pnpm pr — Runs CI locally, captures test evidence, and opens a PR with it pre-filled.
# Usage: pnpm pr [--base <branch>] [--title "..."] [--draft] [--skip-ci]

set -euo pipefail

BASE="main"
TITLE=""
DRAFT_FLAG=""
SKIP_CI=0

while [[ $# -gt 0 ]]; do
  case $1 in
    --base) BASE="$2"; shift 2 ;;
    --title) TITLE="$2"; shift 2 ;;
    --draft) DRAFT_FLAG="--draft"; shift ;;
    --skip-ci) SKIP_CI=1; shift ;;
    *) shift ;;
  esac
done

if [ -z "$TITLE" ]; then
  TITLE=$(git log -1 --format="%s")
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)
CI_OUTPUT_FILE=$(mktemp)
TEST_DETAIL_FILE=$(mktemp)

echo "🔍 Running CI pipeline to collect evidence..."
echo ""

if [ "$SKIP_CI" = "0" ]; then
  # Run lint + typecheck
  if ! pnpm turbo run lint >> "$CI_OUTPUT_FILE" 2>&1; then
    echo "❌ Lint failed. Fix errors before opening PR."
    cat "$CI_OUTPUT_FILE"; rm "$CI_OUTPUT_FILE" "$TEST_DETAIL_FILE"; exit 1
  fi

  if ! pnpm turbo run typecheck >> "$CI_OUTPUT_FILE" 2>&1; then
    echo "❌ Typecheck failed. Fix errors before opening PR."
    cat "$CI_OUTPUT_FILE"; rm "$CI_OUTPUT_FILE" "$TEST_DETAIL_FILE"; exit 1
  fi

  # Run tests and capture full output
  if ! pnpm turbo run test 2>&1 | tee -a "$CI_OUTPUT_FILE" | tee "$TEST_DETAIL_FILE" > /dev/null; then
    echo "❌ Tests failed. Fix errors before opening PR."
    cat "$CI_OUTPUT_FILE"; rm "$CI_OUTPUT_FILE" "$TEST_DETAIL_FILE"; exit 1
  fi

  if ! pnpm turbo run build >> "$CI_OUTPUT_FILE" 2>&1; then
    echo "❌ Build failed. Fix errors before opening PR."
    cat "$CI_OUTPUT_FILE"; rm "$CI_OUTPUT_FILE" "$TEST_DETAIL_FILE"; exit 1
  fi

  echo "✅ CI passed."

  # Extract test summary per package
  TEST_SUMMARY=$(grep -E "Test Files|Tests |Duration|passed|failed" "$TEST_DETAIL_FILE" 2>/dev/null | tail -20 || echo "(run pnpm test for details)")

  # Extract overall counts
  TOTAL_TESTS=$(grep -E "^@|^recetario" "$TEST_DETAIL_FILE" | grep "Tests " | awk '{sum += $NF} END {print sum}' 2>/dev/null || echo "?")
  TOTAL_FILES=$(grep -E "^@|^recetario" "$TEST_DETAIL_FILE" | grep "Test Files" | grep -oE "[0-9]+ passed" | awk '{sum += $1} END {print sum}' 2>/dev/null || echo "?")
else
  echo "⚠️  CI skipped (--skip-ci)"
  TEST_SUMMARY="(CI skipped — run pnpm ci:local to verify)"
  TOTAL_TESTS="?"
  TOTAL_FILES="?"
fi

CI_SUMMARY="$TEST_SUMMARY"
rm "$CI_OUTPUT_FILE" "$TEST_DETAIL_FILE" 2>/dev/null || true

# Notion stories from recent commits
NOTION_LINKS=$(git log "origin/$BASE..HEAD" --format="%B" 2>/dev/null \
  | grep -o 'https://app.notion.com/p/[a-z0-9]*' | sort -u | head -5 || echo "")

# Commits since base
COMMITS=$(git log "origin/$BASE..HEAD" --format="- %s" 2>/dev/null | head -10)

PR_BODY=$(cat <<PREOF
## What does this PR do?

-

## Motivation



## Key changes

$COMMITS

## Evidence

### ✅ Local CI (\`pnpm ci:local\`)

\`\`\`
$CI_SUMMARY
\`\`\`

## Notion

$(if [ -n "$NOTION_LINKS" ]; then echo "$NOTION_LINKS" | while read -r url; do echo "- $url"; done; else echo "<!-- Add Notion story link -->"; fi)

## Checklist

- [x] \`pnpm ci:local\` passed without errors
- [ ] No debug \`console.log\` or unnecessary \`any\`
- [ ] Notion story → "In review" with link to this PR
- [ ] DB migration included if schema changed
- [ ] New routes/functions have tests maintaining 100% coverage
PREOF
)

echo ""
echo "📝 Opening PR: \"$TITLE\""
echo "   Base: $BASE  ←  $BRANCH"
echo ""

gh pr create \
  --title "$TITLE" \
  --base "$BASE" \
  --body "$PR_BODY" \
  $DRAFT_FLAG

echo ""
echo "🎉 PR created. Fill in 'What does this PR do?' and 'Motivation' sections."
