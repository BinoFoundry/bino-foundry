#!/usr/bin/env bash
# Full production build for VPS/CI — vendor-neutral.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Installing dependencies"
npm ci

echo "==> Env check (${APP_ENV:-production})"
APP_ENV="${APP_ENV:-production}" npm run env:check

echo "==> Building workspaces"
npm run build:all

echo "==> Build complete"
echo "    API:      backend/dist/server.js"
echo "    Frontend: frontend/dist/"
