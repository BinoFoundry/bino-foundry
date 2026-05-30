# Milestone 1 — Project structure (completed)

Monorepo layout and shared packages. **Status: done.**

| Item | Status | Notes |
|------|--------|-------|
| Separate `frontend/` (Vite SPA) | Done | `@bino-foundry/frontend` |
| Separate `backend/` (Express + TypeScript) | Done | `@bino-foundry/backend` |
| npm workspaces at repo root | Done | `frontend`, `backend`, `shared` |
| `@bino-foundry/shared` | Done | Storage path helpers, shared types |
| `frontend/src/config/env.ts` + env examples | Done | `VITE_API_BASE_URL`, `VITE_ADMIN_API_KEY` |
| `frontend/src/services/api/` | Done | `apiRequest`, domain clients (catalogue, bracelet, rendering, upload) |
| `frontend/src/render/` | Done | Full compositor module (not a placeholder) — see [render README](../frontend/src/render/README.md) |
| `frontend/src/features/` | Done | `admin/`, `sunglasses/`, `bracelet/` |
| `backend/src/config/load-env.ts` | Done | Multi-path `.env` merge |
| `database/migrations/` + `database/schema/` | Done | 10 migrations — see [migrations README](../database/migrations/README.md) |
| `docs/PROJECT_STRUCTURE.md` | Done | |
| `deploy/` (Docker, nginx, PM2, Vercel) | Done | [deploy/README.md](../deploy/README.md) |
| Root scripts: `dev`, `build:all`, `lint`, `test`, `env:check` | Done | |
| CI workflow | Done | `.github/workflows/ci.yml` |

## Verify

```bash
npm ci
npm run lint
npm run build:all
```

## Milestone 2

Structural work is complete. M2 adds feature depth inside this layout — see [MILESTONE2_OVERVIEW.md](./MILESTONE2_OVERVIEW.md).
