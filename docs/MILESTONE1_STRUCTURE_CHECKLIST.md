# Milestone 1 — Project structure migration (completed)

Deliverables for this step only:

| Item | Status |
|------|--------|
| Separate `frontend/` (Vite SPA) | Done |
| Separate `backend/` (Express workspace with `src/`) | Done |
| npm workspaces orchestration at repo root | Done |
| `@bino-foundry/shared` constants/types package | Done |
| `frontend/src/config/env.ts` + `.env.example` | Done |
| `frontend/src/services/api/client.ts` base client | Done |
| `frontend/src/render/` placeholder module | Done |
| `frontend/src/features/` scaffold for future splits | Done |
| `backend/src/config/load-env.ts` multi-path `.env` | Done |
| `database/migrations/` reserved for Supabase SQL | Stub |
| `docs/PROJECT_STRUCTURE.md` | Done |
| Legacy one-off scripts → `scripts/legacy/` | Done |
| Lint / test / build pass from root (`npm run lint`, `test`, `build`) | Done |

**Not required for this step:** backend TypeScript port, `/api/v1` routing, Supabase wiring, Dockerfile.
