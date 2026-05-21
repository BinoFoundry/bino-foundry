# Bino Foundry — documentation

Developer documentation for the Phase 1 monorepo. Start here, then open the guide for your task.

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
- [Milestone checklists](#milestone-checklists) — Phase 1 delivery tracking

## Milestone checklists

| Checklist | Scope |
|-----------|--------|
| [Structure](./MILESTONE1_STRUCTURE_CHECKLIST.md) | Monorepo layout |
| [Database](./MILESTONE1_DATABASE_CHECKLIST.md) | SQL schema |
| [Backend](./MILESTONE1_BACKEND_CHECKLIST.md) | Express API |
| [Frontend](./MILESTONE1_FRONTEND_CHECKLIST.md) | SPA builders |
| [Render](./MILESTONE1_RENDER_CHECKLIST.md) | Sunglasses compositor |
| [Storage](./MILESTONE1_STORAGE_CHECKLIST.md) | Supabase buckets |
| [Deploy](./MILESTONE1_DEPLOY_CHECKLIST.md) | Docker / VPS / Vercel |
| [Admin](./MILESTONE1_ADMIN_CHECKLIST.md) | Admin dashboard foundation |
| [Docs](./MILESTONE1_DOCS_CHECKLIST.md) | This documentation set |

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
| Admin section or module | [architecture/ADMIN.md](./architecture/ADMIN.md), [MILESTONE1_ADMIN_CHECKLIST.md](./MILESTONE1_ADMIN_CHECKLIST.md) |
| Frontend feature folder | [architecture/FRONTEND.md](./architecture/FRONTEND.md), [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) |

After editing links, spot-check [setup/GETTING_STARTED.md](./setup/GETTING_STARTED.md) on a clean clone when setup steps change.
