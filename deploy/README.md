# Deployment (Phase 1)

Vendor-neutral layout: **Vercel** (static SPA) + **VPS/Docker/PM2** (Express API). Supabase stays external (database + storage only).

## Environment strategy

| Layer | Files | Notes |
|-------|--------|--------|
| API | `.env`, `.env.local`, `.env.staging`, `.env.production` at **repo root** | Loaded by `backend/src/config/load-env.ts` |
| API templates | [`env/.env.staging.example`](./env/.env.staging.example), [`env/.env.production.example`](./env/.env.production.example) | Copy and fill secrets |
| SPA (Vite) | `frontend/.env.development.local`, `.env.staging`, `.env.production` | Build-time only (`VITE_*`) |
| SPA templates | [`env/frontend.staging.example`](./env/frontend.staging.example), [`env/frontend.production.example`](./env/frontend.production.example) | |

`APP_ENV` controls validation: **staging/production** require `SUPABASE_*` and `CORS_ORIGINS`.

Shell exports (e.g. `APP_ENV=production npm run start:api:prod`) override values in `.env` so local dev settings are not clobbered during production smoke tests.

Check config before deploy:

```bash
npm run env:check
APP_ENV=staging npm run env:check
```

## Build

```bash
npm ci
npm run build:all
```

Outputs:

- `backend/dist/` — Node API
- `frontend/dist/` — static SPA

## Option A — Vercel (frontend) + VPS (API)

1. **Vercel**: set root directory to `frontend`, build `npm run build`, output `dist`.
2. Set env: `VITE_API_BASE_URL=https://api.yourdomain.com`, optional `VITE_ADMIN_API_KEY`.
3. **API** on VPS: use Docker, PM2, or systemd below; set `CORS_ORIGINS` to your Vercel URL.

See [`../frontend/vercel.json`](../frontend/vercel.json) and repo [`vercel.json`](../vercel.json).

## Option B — Single VPS (nginx + API + static, no Docker)

**Step-by-step guide:** [`VPS_SETUP.md`](./VPS_SETUP.md) — **binofoundry.temukreatif.id** (Node + PM2 + nginx + Let’s Encrypt).

Quick summary:

1. App install under `/opt/bino-foundry` — `npm run build:all`
2. Publish SPA — `sudo npm run deploy:web` → `/var/www/bino-foundry`
3. API on `127.0.0.1:5050` with `TRUST_PROXY=1` (PM2 or systemd)
4. nginx `root /var/www/bino-foundry` — [`nginx/binofoundry.temukreatif.id.conf`](./nginx/binofoundry.temukreatif.id.conf) or [`nginx/bino-foundry.conf`](./nginx/bino-foundry.conf)

Leave `VITE_API_BASE_URL` empty in `frontend/.env.production` — the SPA uses same-origin `/api` through nginx.

## Option C — Docker Compose

```bash
cp .env.example .env   # fill SUPABASE_*, CORS_ORIGINS, etc.
docker compose up -d --build
```

API: `http://localhost:5050/api/status`

## Process management

| Tool | Config |
|------|--------|
| PM2 | [`pm2/ecosystem.config.cjs`](./pm2/ecosystem.config.cjs) |
| systemd | [`systemd/bino-foundry-api.service`](./systemd/bino-foundry-api.service) |

## Health checks

- `GET /api/status` — JSON with `appEnv`
- `GET /api/health` — minimal ok

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/build-production.sh` | CI/VPS full build |
| `scripts/sync-web-root.sh` | `npm run deploy:web` — rsync `frontend/dist` → `/var/www/bino-foundry` |
| `scripts/check-env.mjs` | Validate env for current `APP_ENV` |
| `scripts/start-api-production.sh` | Run compiled API locally |
