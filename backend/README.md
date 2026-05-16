# Bino Foundry — API workspace

Express 5 + TypeScript + Supabase Postgres (PostgREST via `@supabase/supabase-js` service role).

## Layout

```
src/
  app.ts                  # Middleware + route mounting (/api · /api/v1)
  server.ts               # bootstrap
  config/                 # env (Zod) + dotenv bootstrap
  infra/                  # Cloudinary + Supabase (Postgres catalogue via PostgREST, Storage uploads)
  lib/                    # errors, responses, validation helpers
  middleware/             # auth, cors, multer, error handler
  modules/*/              # Domain slice: *.validation · *.service · *.controller · *.routes
  openapi/                # OpenAPI 3 spec (Swagger UI at /api/docs)
  routes/                 # Composed routers (health + catalogue + docs)
```

## Commands

`@bino-foundry/shared` emits `dist/` with storage path helpers consumed by compiled imports; `npm run dev`/`start`/`typecheck` will therefore compile the workspace once up front (`pre*` scripts).

| Script | Purpose |
|--------|---------|
| `npm run dev --workspace backend` | `tsx watch` for local iteration |
| `npm run build --workspace backend` | Emit `dist/` (`tsc`) |
| `npm run start --workspace backend` | Run `tsx src/server.ts` (no compile) |
| `npm run start:prod --workspace backend` | `node dist/server.js` after build |
| `npm run start:api:prod` (root) | Production API via `scripts/start-api-production.sh` |
| `npm run typecheck --workspace backend` | `tsc --noEmit` |

## Environment

See repo root [.env.example](../.env.example) and [deploy/env/](../deploy/env/). Highlights:

- `APP_ENV` — `development` | `staging` | `production` (loads `.env.{APP_ENV}`).
- `ADMIN_API_KEY` — when present, catalogue **mutations** + upload require `x-api-key`.
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — **required** when `APP_ENV` is staging/production.
- `CORS_ORIGINS` — required in staging/production; optional in development.
- `TRUST_PROXY=1` — set when behind nginx/Caddy on a VPS.
- Health: `GET /api/status`, `GET /api/health`.
- Docs: `GET /api/docs` (Swagger UI), `GET /api/openapi.json` — see [docs/api/SWAGGER.md](../docs/api/SWAGGER.md).

Deploy guide: [deploy/README.md](../deploy/README.md). Full docs: [docs/README.md](../docs/README.md).

## Response contracts

- Successful catalogue responses stay **raw JSON arrays/objects** (legacy SPA compatibility).
- Failures use `{ success:false, error:{code,message,details}, requestId, message }`.
