#!/usr/bin/env bash
# Publish frontend/dist to the nginx document root (industry-standard split deploy).
# Usage (on VPS, after npm run build:all):
#   sudo bash scripts/sync-web-root.sh
# Override target: WEB_ROOT=/var/www/other sudo -E bash scripts/sync-web-root.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="${ROOT}/frontend/dist"
WEB_ROOT="${WEB_ROOT:-/var/www/bino-foundry}"
WEB_USER="${WEB_USER:-www-data}"
WEB_GROUP="${WEB_GROUP:-www-data}"

if [[ ! -f "${DIST}/index.html" ]]; then
  echo "Missing ${DIST}/index.html — run: npm run build:all" >&2
  exit 1
fi

if [[ ! -d "${WEB_ROOT}" ]]; then
  echo "Creating ${WEB_ROOT}"
  mkdir -p "${WEB_ROOT}"
fi

echo "==> Syncing ${DIST}/ → ${WEB_ROOT}/"
rsync -a --delete "${DIST}/" "${WEB_ROOT}/"

if [[ "$(id -u)" -eq 0 ]]; then
  chown -R "${WEB_USER}:${WEB_GROUP}" "${WEB_ROOT}"
  find "${WEB_ROOT}" -type d -exec chmod 755 {} \;
  find "${WEB_ROOT}" -type f -exec chmod 644 {} \;
  echo "==> Ownership: ${WEB_USER}:${WEB_GROUP}"
else
  echo "==> Tip: run with sudo to chown ${WEB_USER}:${WEB_GROUP} on ${WEB_ROOT}"
fi

echo "==> Web root ready: ${WEB_ROOT}"
