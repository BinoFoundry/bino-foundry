# Bino Foundry — documentation

Developer documentation for the Bino Foundry monorepo. **Milestone 1** (foundation) is complete; **Milestone 2** (core builder development) is active. Start here, then open the guide for your task.

## Quick start

| I want to… | Read |
|------------|------|
| Run the app locally | [setup/GETTING_STARTED.md](./setup/GETTING_STARTED.md) |
| Configure env vars | [environment/README.md](./environment/README.md) |
| Understand the system | [architecture/OVERVIEW.md](./architecture/OVERVIEW.md) |
| Work on the admin dashboard | [architecture/ADMIN.md](./architecture/ADMIN.md) |
| Call or extend the API | [api/README.md](./api/README.md) |
| Swagger / OpenAPI | [api/SWAGGER.md](./api/SWAGGER.md) |
| Upload / store images | [assets/WORKFLOW.md](./assets/WORKFLOW.md) |
| Day-to-day dev commands | [development/WORKFLOW.md](./development/WORKFLOW.md) |
| Deploy | [../deploy/README.md](../deploy/README.md) |

## Documentation map

### Setup

- [Getting started](./setup/GETTING_STARTED.md) — install, env, dev servers, smoke tests
- [Database & Supabase](./setup/DATABASE.md) — migrations, catalogue tables, sunglasses catalog

### Architecture

- [Overview](./architecture/OVERVIEW.md) — monorepo, boundaries, Supabase role
- [Frontend](./architecture/FRONTEND.md) — SPA layers, state, render engine
- [Backend](./architecture/BACKEND.md) — Express modules, infra, auth
- [Admin](./architecture/ADMIN.md) — dashboard layout, CRUD modules, media

### API

- [API guide](./api/README.md) — prefixes, auth, client usage
- [Endpoints](./api/ENDPOINTS.md) — route reference (source of truth: `backend/src/modules/`)
- [Errors](./api/ERRORS.md) — error envelope and status codes
- [Swagger](./api/SWAGGER.md) — OpenAPI UI, spec maintenance, admin mutations

### Operations

- [Environment](./environment/README.md) — `APP_ENV`, files, CORS, secrets
- [Development workflow](./development/WORKFLOW.md) — commands, PR checklist, admin dev
- [Asset workflow](./assets/WORKFLOW.md) — buckets, staging, admin Media section

### Reference

- [Project structure](./PROJECT_STRUCTURE.md) — directory tree
- [Milestone checklists](#milestone-checklists) — delivery tracking

## Milestone checklists

### Milestone 1 — Foundation (complete)

Sign-off: [MILESTONE1_SIGNOFF.md](./MILESTONE1_SIGNOFF.md)

| Checklist | Scope |
|-----------|--------|
| [Structure](./MILESTONE1_STRUCTURE_CHECKLIST.md) | Monorepo layout |
| [Database](./MILESTONE1_DATABASE_CHECKLIST.md) | SQL schema + migrations `000001`–`000010` |
| [Backend](./MILESTONE1_BACKEND_CHECKLIST.md) | Express API + Supabase |
| [Frontend](./MILESTONE1_FRONTEND_CHECKLIST.md) | SPA + builders foundation |
| [Render](./MILESTONE1_RENDER_CHECKLIST.md) | Sunglasses + SVG clip pipeline |
| [Storage](./MILESTONE1_STORAGE_CHECKLIST.md) | Supabase buckets |
| [Deploy](./MILESTONE1_DEPLOY_CHECKLIST.md) | Docker / VPS / Vercel |
| [Admin](./MILESTONE1_ADMIN_CHECKLIST.md) | Admin dashboard foundation |
| [Docs](./MILESTONE1_DOCS_CHECKLIST.md) | Documentation set |

### Milestone 2 — Core development (planned)

**Guide:** [MILESTONE2_OVERVIEW.md](./MILESTONE2_OVERVIEW.md) (contract deliverables + work order)

| Checklist | Proposal scope |
|-----------|----------------|
| [Sunglasses](./MILESTONE2_SUNGLASSES_CHECKLIST.md) | Frame, lens, tint, preview |
| [Render](./MILESTONE2_RENDER_CHECKLIST.md) | Real-time 2D layered rendering |
| [Bracelet](./MILESTONE2_BRACELET_CHECKLIST.md) | Categories, sizing, quantity, responsive, scaling |
| [Frontend](./MILESTONE2_FRONTEND_CHECKLIST.md) | Shared UX, a11y, mobile shell |
| [Admin](./MILESTONE2_ADMIN_CHECKLIST.md) | Glasses, tints, crystals, pricing |
| [Backend](./MILESTONE2_BACKEND_CHECKLIST.md) | Auth, RLS, API (supporting) |
| [Commerce](./MILESTONE2_COMMERCE_CHECKLIST.md) | Optional · not in proposal list |

## Package READMEs

| Path | Scope |
|------|--------|
| [../README.md](../README.md) | Repo entry point |
| [../frontend/README.md](../frontend/README.md) | Vite SPA |
| [../backend/README.md](../backend/README.md) | Express API |
| [../shared/README.md](../shared/README.md) | Shared types/constants |
| [../database/migrations/README.md](../database/migrations/README.md) | SQL migrations |
| [../deploy/README.md](../deploy/README.md) | Deployment |
| [../frontend/src/features/admin/README.md](../frontend/src/features/admin/README.md) | Admin feature module |

## Maintaining these docs

Update docs in the **same PR** as code when you change:

| Change | Update |
|--------|--------|
| New route under `backend/src/modules/` | [api/ENDPOINTS.md](./api/ENDPOINTS.md), [backend/src/openapi/paths.ts](../backend/src/openapi/paths.ts), [api/SWAGGER.md](./api/SWAGGER.md) if behaviour differs |
| Env var in `backend/src/config/env.ts` | [environment/README.md](./environment/README.md), `.env.example` |
| Storage path or bucket | [assets/WORKFLOW.md](./assets/WORKFLOW.md), `database/storage/` |
| Admin section or module | [architecture/ADMIN.md](./architecture/ADMIN.md), relevant M1/M2 checklist |
| Milestone scope | [MILESTONE1_SIGNOFF.md](./MILESTONE1_SIGNOFF.md), [MILESTONE2_OVERVIEW.md](./MILESTONE2_OVERVIEW.md) |
| Frontend feature folder | [architecture/FRONTEND.md](./architecture/FRONTEND.md), [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) |

After editing links, spot-check [setup/GETTING_STARTED.md](./setup/GETTING_STARTED.md) on a clean clone when setup steps change.
