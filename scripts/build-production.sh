#!/usr/bin/env bash
# Full production build for VPS/CI — vendor-neutral.
# On small VPS hosts, Vite can be OOM-killed (exit 137) without swap / free RAM.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ensure_swap() {
  # Skip when swap already exists or we are not root.
  if [[ "$(id -u)" -ne 0 ]]; then
    return 0
  fi
  local swap_total
  swap_total="$(awk '/SwapTotal:/ { print $2 }' /proc/meminfo 2>/dev/null || echo 0)"
  if [[ "${swap_total}" -gt 0 ]]; then
    return 0
  fi
  echo "==> No swap detected — creating 2G /swapfile for the build"
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
}

echo "==> Installing dependencies"
npm ci

echo "==> Env check (${APP_ENV:-production})"
APP_ENV="${APP_ENV:-production}" npm run env:check

# Free RAM for Vite when the API is already running on the same host.
if command -v pm2 >/dev/null 2>&1 && pm2 describe bino-foundry-api >/dev/null 2>&1; then
  echo "==> Stopping API during frontend build (reduces OOM risk)"
  pm2 stop bino-foundry-api || true
  RESTART_API=1
else
  RESTART_API=0
fi

ensure_swap

echo "==> Building workspaces"
# Cap Node heap so the process fails with a JS OOM instead of a silent Linux kill when possible.
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1536}"
npm run build:all

if [[ "${RESTART_API}" -eq 1 ]]; then
  echo "==> Restarting API"
  pm2 start bino-foundry-api || pm2 restart bino-foundry-api || true
fi

echo "==> Build complete"
echo "    API:      backend/dist/server.js"
echo "    Frontend: frontend/dist/ (build output)"
echo "    Publish:  sudo npm run deploy:web  → /var/www/bino-foundry (nginx document root)"
