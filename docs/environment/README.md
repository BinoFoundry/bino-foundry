# Environment configuration

How configuration is loaded and validated across the monorepo.

## Two layers

| Layer | Location | Consumed by |
|-------|----------|-------------|
| **API** | Repo root `.env*` | Express (`backend/src/config/`) |
| **SPA** | `frontend/.env*` | Vite build / dev server (`VITE_*` only) |

Never put `SUPABASE_SERVICE_ROLE_KEY` in frontend env files.

## `APP_ENV`

| Value | Purpose |
|-------|---------|
| `development` | Local daily work |
| `staging` | Pre-production |
| `production` | Live |

Controls:

- Which files load (`.env.{APP_ENV}`)
- Validation strictness in `backend/src/config/env.ts`
- CORS: development **merges** `http://localhost:8080` into allowlist

## API load order

Implemented in [`backend/src/config/load-env.ts`](../../backend/src/config/load-env.ts):

1. `.env`
2. `.env.local`
3. `.env.{APP_ENV}`
4. `.env.{APP_ENV}.local`

Searched in: repo root, `deploy/env/`, `backend/`, cwd.

**Shell exports win** — e.g. `APP_ENV=production npm run start:api:prod` overrides `.env` values for preserved keys (`APP_ENV`, `NODE_ENV`, `PORT`, `SUPABASE_*`, `CORS_ORIGINS`, etc.).

## API variables

| Variable | Required (dev) | Required (staging/prod) | Notes |
|----------|----------------|-------------------------|--------|
| `APP_ENV` | optional | yes | Default `development` |
| `NODE_ENV` | optional | yes | Often `production` on server |
| `PORT` | optional | yes | Default `5050` |
| `SUPABASE_URL` | optional* | yes | *Needed for full API |
| `SUPABASE_SERVICE_ROLE_KEY` | optional* | yes | Server only |
| `CORS_ORIGINS` | optional | yes | Comma-separated SPA origins |
| `ADMIN_API_KEY` | optional | recommended | Mutation guard (see below) |
| `TRUST_PROXY` | optional | `1` behind nginx | |
| `CLOUDINARY_*` | optional | optional | Legacy public upload fallback |

Templates:

- Root: [`.env.example`](../../.env.example)
- Staging: [`deploy/env/.env.staging.example`](../../deploy/env/.env.staging.example)
- Production: [`deploy/env/.env.production.example`](../../deploy/env/.env.production.example)

## Frontend variables

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | API origin, no trailing slash |
| `VITE_API_PREFIX` | Default `/api` |
| `VITE_ADMIN_API_KEY` | Sends `x-api-key` on POST/PUT/DELETE from the SPA |

| File | Used when |
|------|-----------|
| `.env.development.local` | `npm run dev` |
| `.env.staging` | `npm run build:staging` |
| `.env.production` | `npm run build` / Vercel |

Templates: `frontend/.env.example`, `.env.staging.example`, `.env.production.example`.

## Admin API keys (Phase 1)

The admin dashboard at `/admin` calls the same API as the builders. There is **no separate admin secret**.

| Surface | Variable | Header |
|---------|----------|--------|
| API server | `ADMIN_API_KEY` | Validates incoming `x-api-key` / `Authorization: Bearer` on mutations |
| SPA | `VITE_ADMIN_API_KEY` | `frontend/src/services/api/client.ts` attaches key on non-GET requests |

**Local dev:** use the same value in both files so Sunglasses config saves, staging uploads, and form image uploads succeed.

**Production:** set a strong random key on the API host only; inject `VITE_ADMIN_API_KEY` at frontend build time (CI secret). Phase 1 does not hide `/admin` in the SPA — rely on key + network policy until route auth ships.

Swagger UI uses the same key: **Authorize** at http://localhost:5050/api/docs.

## Validate

```bash
npm run env:check
APP_ENV=staging npm run env:check
```

## CORS (local dev)

If `CORS_ORIGINS` lists only production URLs, **development** still allows:

- `http://localhost:8080`
- `http://127.0.0.1:8080`
- `http://localhost:5173`

See [`backend/src/config/env.ts`](../../backend/src/config/env.ts) — `LOCAL_DEV_CORS_ORIGINS`.

## Related

- [Getting started](../setup/GETTING_STARTED.md)
- [Admin architecture](../architecture/ADMIN.md)
- [Deploy](../../deploy/README.md)
