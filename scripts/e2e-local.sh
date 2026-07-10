#!/usr/bin/env bash
# Isolated local E2E: brings up the dedicated E2E stack (its own Postgres/API/app
# on 5433/3001/8081), resets it to a clean seeded baseline, runs Playwright
# against it, then resets again so the env is clean for next time. The manual
# stack (8080/3000/recetario) is never touched.
set -euo pipefail
cd "$(dirname "$0")/.."

E2E_DB="postgres://recetario:recetario@localhost:5433/recetario_e2e"
API_E2E="http://localhost:3001"
APP_E2E="http://localhost:8081"

echo "▶ Bringing up the isolated E2E stack..."
docker compose --profile e2e up -d --build postgres-e2e api-e2e app-e2e

echo "▶ Waiting for the E2E API..."
until curl -sf "$API_E2E/health" >/dev/null 2>&1; do sleep 1; done

reset() {
  echo "▶ Resetting the E2E database to a clean baseline..."
  DATABASE_URL="$E2E_DB" pnpm --filter @recetario/api exec tsx src/scripts/reset-db.ts
  API_URL="$API_E2E" pnpm --filter @recetario/api seed:e2e-accounts
}

reset  # clean state BEFORE
echo "▶ Running E2E against $APP_E2E ..."
set +e
PLAYWRIGHT_BASE_URL="$APP_E2E" EXPO_PUBLIC_API_URL="$API_E2E" \
  pnpm --filter recetario-app exec playwright test "$@"
STATUS=$?
set -e
reset  # clean state AFTER

exit $STATUS
