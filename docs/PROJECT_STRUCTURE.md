# Project structure

Monorepo (npm workspaces) with a strict split between SPA and API.

```
bino-foundry/
├── frontend/              # Vite + React + TypeScript (@bino-foundry/frontend)
│   └── src/
│       ├── features/
│       │   ├── admin/     # AdminApp, dashboard, products, pricing, media
│       │   └── sunglasses/
│       ├── state/         # catalogue, sunglasses-catalog providers
│       ├── services/api/  # HTTP clients
│       └── render/        # Sunglasses compositor
├── backend/               # Express + TS API (@bino-foundry/backend)
│   └── src/
│       ├── modules/       # frames, crystals, types, sunglasses, upload
│       └── openapi/       # OpenAPI spec (Swagger)
├── shared/                # Constants + types (@bino-foundry/shared)
├── database/              # SQL migrations, storage layout docs
├── docs/                  # Developer documentation → docs/README.md
├── deploy/                # Docker, nginx, PM2, env templates
└── scripts/               # build-production.sh, check-env.mjs, …
```

## Commands (from repo root)

| Script | Purpose |
|--------|---------|
| `npm run dev` | Frontend Vite dev server (port 8080) |
| `npm run dev:backend` | API dev server (`tsx watch`, port 5050) |
| `npm run build:all` | Build shared + backend + frontend |
| `npm run build:backend` | Emit `backend/dist/` |
| `npm run build` | Frontend production build (`frontend/dist`) |
| `npm run env:check` | Validate environment |
| `npm run start:api:prod` | Run compiled API |

See [development/WORKFLOW.md](./development/WORKFLOW.md).

## Configuration

| Location | Responsibility |
|----------|------------------|
| `frontend/.env*` | `VITE_*` vars only (bundled client) |
| `.env` (repo root) | API secrets (`SUPABASE_*`, `ADMIN_API_KEY`, `CORS_ORIGINS`) |

See [environment/README.md](./environment/README.md) and [.env.example](../.env.example).

## Documentation

Full map: **[docs/README.md](./README.md)**

| Area | Entry |
|------|--------|
| Setup | [setup/GETTING_STARTED.md](./setup/GETTING_STARTED.md) |
| Admin | [architecture/ADMIN.md](./architecture/ADMIN.md) |
| API + Swagger | [api/README.md](./api/README.md) |

## Deploy

Configure Vercel with **`frontend`** as the app root, or use root `vercel.json`. Run the API on VPS/Docker/PM2 — [deploy/README.md](../deploy/README.md).
