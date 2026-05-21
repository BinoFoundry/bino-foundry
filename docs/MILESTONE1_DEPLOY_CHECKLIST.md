# Milestone 1 · Environment & deployment

## Delivered

- [x] `APP_ENV` + layered `.env` loading (`backend/src/config/load-env.ts`)
- [x] Staging/production validation (`SUPABASE_*`, `CORS_ORIGINS`) in `backend/src/config/env.ts`
- [x] Env templates: root `.env.example`, `deploy/env/*`, `frontend/.env.*.example`
- [x] Build scripts: `npm run build:all`, `scripts/build-production.sh`
- [x] Env check: `npm run env:check` (`scripts/check-env.mjs`)
- [x] Docker: `Dockerfile`, `Dockerfile.frontend`, `docker-compose.yml`
- [x] VPS: nginx example, PM2 `ecosystem.config.cjs`, systemd unit
- [x] Vercel: root + `frontend/vercel.json`
- [x] CI: `.github/workflows/ci.yml`
- [x] Health: `/api/status`, `/api/health`

## Verify locally

```bash
cp .env.example .env          # fill SUPABASE_* for full API
cp frontend/.env.example frontend/.env.development.local
npm run env:check
npm run build:all
APP_ENV=production npm run start:api:prod
# /api/status should show appEnv "production" (shell export wins over .env)
```

## Verify Docker

```bash
docker compose up -d --build
curl http://localhost:5050/api/status
```

## Docs

See [deploy/README.md](../deploy/README.md).
