#!/bin/bash
# pnpm pr — Runs CI locally, captures evidence, and opens a PR with it embedded.
# Usage: pnpm pr [--base <branch>] [--title "..."] [--draft]
# If title is omitted, uses the last commit message subject.

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

# Default title from last commit
if [ -z "$TITLE" ]; then
  TITLE=$(git log -1 --format="%s")
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)
CI_OUTPUT_FILE=$(mktemp)

echo "🔍 Running CI pipeline to collect evidence..."
echo ""

CI_PASSED=1
if [ "$SKIP_CI" = "0" ]; then
  {
    echo "=== Lint ==="
    pnpm turbo run lint 2>&1 | tail -3
    echo ""
    echo "=== Type check ==="
    pnpm turbo run typecheck 2>&1 | tail -3
    echo ""
    echo "=== Tests ==="
    pnpm turbo run test 2>&1 | grep -E "Test Files|Tests|Duration|passed|failed" | tail -8
    echo ""
    echo "=== Build ==="
    pnpm turbo run build 2>&1 | tail -3
  } > "$CI_OUTPUT_FILE" 2>&1 || CI_PASSED=0

  if [ "$CI_PASSED" = "0" ]; then
    echo "❌ CI failed. Fix errors before opening PR."
    cat "$CI_OUTPUT_FILE"
    rm "$CI_OUTPUT_FILE"
    exit 1
  fi
  echo "✅ CI passed."
else
  echo "⚠️  CI skipped (--skip-ci)"
  echo "(CI skipped — run pnpm ci:local to verify)" > "$CI_OUTPUT_FILE"
fi

CI_SUMMARY=$(cat "$CI_OUTPUT_FILE")
rm "$CI_OUTPUT_FILE"

# Notion stories from recent commits (grep for notion URLs)
NOTION_LINKS=$(git log "origin/$BASE..HEAD" --format="%B" 2>/dev/null | grep -o 'https://app.notion.com/p/[a-z0-9]*' | sort -u | head -5 || echo "")

# Build PR body
PR_BODY=$(cat <<PREOF
## ¿Qué hace este PR?

-

## Motivación



## Cambios principales

$(git log "origin/$BASE..HEAD" --format="- %s" 2>/dev/null | head -10)

## Evidencia

### ✅ CI local (\`pnpm ci:local\`)

\`\`\`
$CI_SUMMARY
\`\`\`

### 📸 Screenshots / output

N/A

## Notion

$(if [ -n "$NOTION_LINKS" ]; then echo "$NOTION_LINKS" | while read -r url; do echo "- $url"; done; else echo "<!-- Add Notion story link -->"; fi)

## Checklist

- [x] \`pnpm ci:local\` pasó sin errores
- [ ] Sin \`console.log\` de debug ni \`any\` innecesarios
- [ ] Story en Notion → "In review" con link a este PR
- [ ] Migration incluida si hay cambios de DB
- [ ] Testeado en web + mobile si hay cambios de UI
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
echo "🎉 PR created. Update the description with screenshots/details as needed."
