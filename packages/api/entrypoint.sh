#!/bin/sh
set -e

echo "Running database migrations..."
cd /app/packages/api
npx drizzle-kit migrate

echo "Starting API..."
exec node dist/index.js
