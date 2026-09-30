#!/bin/sh
set -e

echo "Running release (migrations + base seed)..."
cd /app/packages/api
node dist/scripts/release.js

echo "Starting API..."
exec node dist/index.js
