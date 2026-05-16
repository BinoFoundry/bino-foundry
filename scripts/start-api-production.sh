#!/usr/bin/env bash
# Run compiled API (after npm run build:all)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/backend"

export APP_ENV="${APP_ENV:-production}"
export NODE_ENV="${NODE_ENV:-production}"

if [[ ! -f dist/server.js ]]; then
  echo "Missing backend/dist/server.js — run: npm run build:all" >&2
  exit 1
fi

exec node dist/server.js
