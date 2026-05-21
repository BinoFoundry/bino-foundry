# Milestone 1 · Documentation foundation

## Delivered

- [x] Documentation hub — [docs/README.md](./README.md) (map, milestones, maintenance table)
- [x] Root README — [../README.md](../README.md) (admin + Swagger URLs)
- [x] Setup guide — [setup/GETTING_STARTED.md](./setup/GETTING_STARTED.md) (admin + Swagger smoke tests)
- [x] Database setup — [setup/DATABASE.md](./setup/DATABASE.md)
- [x] Architecture — [architecture/OVERVIEW.md](./architecture/OVERVIEW.md), [FRONTEND.md](./architecture/FRONTEND.md), [BACKEND.md](./architecture/BACKEND.md), [ADMIN.md](./architecture/ADMIN.md)
- [x] API foundation — [api/README.md](./api/README.md), [ENDPOINTS.md](./api/ENDPOINTS.md), [ERRORS.md](./api/ERRORS.md)
- [x] Swagger / OpenAPI — [api/SWAGGER.md](./api/SWAGGER.md), `backend/src/openapi/`, served at `/api/docs`
- [x] Environment — [environment/README.md](./environment/README.md) (admin key pairing)
- [x] Development workflow — [development/WORKFLOW.md](./development/WORKFLOW.md) (admin dev section)
- [x] Asset workflow — [assets/WORKFLOW.md](./assets/WORKFLOW.md) (Media manager flows)
- [x] Project structure — [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)
- [x] Admin module README — [frontend/src/features/admin/README.md](../frontend/src/features/admin/README.md)

## Post–admin foundation updates

- [x] Admin architecture doc and cross-links from API, assets, setup, dev workflow
- [x] ENDPOINTS.md admin UI mapping column
- [x] SWAGGER.md tag table + admin/Swagger parity checklist
- [x] OpenAPI `document.ts` description (admin + doc pointers)

## Verify

1. Open [docs/README.md](./README.md) — all links resolve.
2. Follow [setup/GETTING_STARTED.md](./setup/GETTING_STARTED.md) on a clean clone (smoke test + admin optional).
3. Cross-check [api/ENDPOINTS.md](./api/ENDPOINTS.md) and `backend/src/openapi/paths.ts` against `backend/src/modules/*/`.
4. Open http://localhost:5050/api/docs after `npm run dev:backend`.

## Maintenance

When adding routes, migrations, env vars, or admin sections — update the matching doc in the same PR. See the table in [docs/README.md](./README.md).
