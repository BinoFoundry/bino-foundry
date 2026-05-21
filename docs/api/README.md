# API guide

Express catalogue API for Bino Foundry.

## Base URL

| Environment | Example |
|-------------|---------|
| Local dev | `http://localhost:5050` |
| Staging / prod | `https://api.yourdomain.com` |

## Path prefixes

Both mount the same router:

```
/api/...
/api/v1/...
```

The SPA uses `VITE_API_PREFIX` (default `/api`). Example:

```
http://localhost:5050/api/frames
```

## Interactive documentation

| Resource | URL (local) |
|----------|-------------|
| Swagger UI | http://localhost:5050/api/docs |
| OpenAPI JSON | http://localhost:5050/api/openapi.json |

See [SWAGGER.md](./SWAGGER.md) for Authorize flow and spec maintenance.

## Authentication

| Method | `ADMIN_API_KEY` set? | Requirement |
|--------|----------------------|-------------|
| GET, HEAD, OPTIONS | any | No key |
| POST, PUT, PATCH, DELETE | empty | Open (dev only — not for production) |
| POST, PUT, PATCH, DELETE | set | `x-api-key: <key>` or `Authorization: Bearer <key>` |

The admin dashboard and `VITE_ADMIN_API_KEY` use the same mechanism — [environment/README.md](../environment/README.md).

## Content types

- **JSON** — `Content-Type: application/json` for catalogue CRUD
- **Multipart** — `POST /api/upload/*` with field name `image`

## Client usage (frontend)

```typescript
import { apiRequest, catalogueApi, sunglassesApi, uploadApi } from "@/services/api";

const frames = await catalogueApi.listFrames();
const catalog = await sunglassesApi.getCatalog();
const adminCatalog = await sunglassesApi.getAdminCatalog();
await uploadApi.uploadStaging(file, "admin-batch");
```

Low-level:

```typescript
await apiRequest<FrameEntry[]>("/frames");
```

Implementation: [`frontend/src/services/api/client.ts`](../../frontend/src/services/api/client.ts).

Module clients:

| Client | File | Used by |
|--------|------|---------|
| `catalogueApi` | `services/api/catalogue.ts` | Builders, catalogue state |
| `sunglassesApi` | `services/api/sunglasses.ts` | Customiser, admin pricing |
| `uploadApi` | `services/api/upload.ts` | Admin forms, Media page |

## Success responses

Phase 1 catalogue routes return **raw JSON** (arrays or objects) for backward compatibility with the SPA.

Health:

```json
{ "status": "ok", "app": "bino-foundry-api", "appEnv": "development", "nodeEnv": "development" }
```

## Errors

Structured envelope on failure — [ERRORS.md](./ERRORS.md).

## Admin ↔ API map

| Admin section | Primary endpoints |
|---------------|-------------------|
| Sunglasses config | `/sunglasses/lens-tints`, `/options`, `/frame-colors`, `GET /sunglasses/catalog/admin` |
| Media | `POST /upload/staging?batch=` |
| Forms (images) | `POST /upload` |
| Frames / crystals / types (Phase 1) | Local catalogue state; API CRUD available at `/frames`, `/crystals`, `/types` |

Details: [ENDPOINTS.md](./ENDPOINTS.md), [architecture/ADMIN.md](../architecture/ADMIN.md).

## Route reference

Full list: [ENDPOINTS.md](./ENDPOINTS.md).

## Extending the API

1. Add `backend/src/modules/<name>/` (validation, service, controller, routes).
2. Register in [`backend/src/routes/catalog.routes.ts`](../../backend/src/routes/catalog.routes.ts).
3. Add paths/schemas in [`backend/src/openapi/`](../../backend/src/openapi/).
4. Add frontend client in `frontend/src/services/api/`.
5. Update [ENDPOINTS.md](./ENDPOINTS.md) and admin docs if user-facing.
