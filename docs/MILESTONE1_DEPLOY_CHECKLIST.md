# Milestone 1 — Environment & deployment (completed)

Vendor-neutral deploy paths for API (VPS/Docker) and SPA (Vercel or static/nginx).

## Delivered

- [x] `APP_ENV` + layered `.env` loading (`backend/src/config/load-env.ts`)
- [x] Staging/production validation (`SUPABASE_*`, `CORS_ORIGINS`) in `backend/src/config/env.ts`
- [x] Env templates: root `.env.example`, `deploy/env/*`, `frontend/.env.*.example`
- [x] `npm run build:all`, `scripts/build-production.sh`, `npm run env:check`
- [x] Docker: `Dockerfile`, `Dockerfile.frontend`, `docker-compose.yml`
- [x] VPS: nginx examples, PM2 `ecosystem.config.cjs`, systemd unit — [deploy/VPS_SETUP.md](../deploy/VPS_SETUP.md)
- [x] Vercel: `vercel.json` (SPA)
- [x] CI: `.github/workflows/ci.yml`
- [x] Health: `/api/status`, `/api/health`

## Supabase (required for full stack)

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend only — never in frontend |
| `ADMIN_API_KEY` | Protect API mutations |
| `VITE_ADMIN_API_KEY` | Admin SPA mutations (build-time) |
| `CORS_ORIGINS` | Production SPA origin(s) |

Default API port in docs: **5050** (avoid macOS AirPlay conflict on 5000).

## Verify locally

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env.development.local
npm run env:check
npm run build:all
npm run dev:backend   # → :5050
npm run dev           # → :8080
```

## Verify Docker

```bash
docker compose up -d --build
curl http://localhost:5050/api/status
```

## Production checklist

- [ ] All migrations `000001`–`000010` applied on production Supabase
- [ ] Storage buckets created (`000002`)
- [ ] Strong `ADMIN_API_KEY`; `VITE_ADMIN_API_KEY` in frontend build
- [ ] `CORS_ORIGINS` set to production SPA URL
- [ ] nginx `try_files` for SPA routes (`/bracelet`, `/sunglasses`, `/admin`)

## Milestone 2

Staging environment parity, secrets rotation, monitoring — noted in [MILESTONE2_OVERVIEW.md](./MILESTONE2_OVERVIEW.md).
