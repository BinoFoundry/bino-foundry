# Swagger / OpenAPI

Swagger UI is available in **local development** only by default (`APP_ENV=development`).
In **staging/production** `/api/docs` and `/api/openapi.json` are **disabled** (404).
Override only for temporary debugging with `ENABLE_API_DOCS=1` — do not leave that on a public host.

`/api/status` stays public (liveness). `/api/health` requires `x-api-key` in staging/production.

## URLs (local dev)

| Resource | URL |
|----------|-----|
| **Swagger UI** | http://localhost:5050/api/docs |
| **OpenAPI JSON** | http://localhost:5050/api/openapi.json |
| Versioned prefix | http://localhost:5050/api/v1/docs · `/api/v1/openapi.json` |

In local dev, Swagger UI needs no key to **view**. Use **Authorize** to set `x-api-key` for mutation requests.

## Tags (spec groups)

| Tag | Routes | Typical admin use |
|-----|--------|-------------------|
| Health | `/status`, `/health` | Deploy smoke tests |
| Frames | `/frames` | Product catalogue (API; admin sync pending) |
| Crystals | `/crystals` | Bracelet beads |
| Types | `/types` | Crystal taxonomy |
| Sunglasses | `/sunglasses/*` | Admin → Sunglasses config |
| Upload | `/upload`, `/upload/staging` | Admin → Media, form image pickers |

## Try mutations from Swagger

1. Set `ADMIN_API_KEY` in root `.env` and restart `npm run dev:backend`.
2. Open http://localhost:5050/api/docs
3. Click **Authorize** → enter the same value as `x-api-key` (no `Bearer` prefix required for apiKey scheme).
4. Execute POST/PUT/DELETE — e.g. create a lens tint under **Sunglasses**.

`persistAuthorization: true` keeps the key across page reloads (see `docs.routes.ts`).

## Try from the admin UI

Same key in `frontend/.env.development.local`:

```env
VITE_ADMIN_API_KEY=<same as ADMIN_API_KEY>
```

Then use **Sunglasses config** or **Media** at http://localhost:8080/admin.

## Maintaining the spec

Source of truth (Phase 1):

| File | Role |
|------|------|
| [`backend/src/openapi/document.ts`](../../backend/src/openapi/document.ts) | Metadata, tags, `components.securitySchemes` |
| [`backend/src/openapi/schemas.ts`](../../backend/src/openapi/schemas.ts) | Reusable schemas, parameters, `apiKeySecurity` |
| [`backend/src/openapi/paths.ts`](../../backend/src/openapi/paths.ts) | Path operations (must match Express routes) |

Mounted in [`backend/src/app.ts`](../../backend/src/app.ts):

- `GET {base}/openapi.json` — raw spec
- `{base}/docs` — Swagger UI (`createDocsRoutes`)

### Checklist when adding a route

1. Implement module under `backend/src/modules/...`
2. Register router in `catalog.routes.ts`
3. Add operation to `paths.ts` (method, tags, security, requestBody, responses)
4. Add or reuse schemas in `schemas.ts`
5. Update [ENDPOINTS.md](./ENDPOINTS.md)
6. Add `frontend/src/services/api/` client if the SPA needs it
7. Smoke-test in Swagger UI and, if applicable, admin section

Future option: generate from Zod via `@asteasolutions/zod-to-openapi` aligned with `*.validation.ts`.

## Export & contract testing

```bash
curl -s http://localhost:5050/api/openapi.json -o openapi.json
```

Import into Postman, Insomnia, or CI contract tests.

## Related

- [API guide](./README.md)
- [Endpoints reference](./ENDPOINTS.md)
- [Admin architecture](../architecture/ADMIN.md)
