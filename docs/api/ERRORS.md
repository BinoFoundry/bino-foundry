# API errors

Failed requests return JSON with a consistent envelope (except legacy edge cases).

## Shape

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Frame not found",
    "details": null
  },
  "requestId": "uuid-or-short-id",
  "message": "Frame not found"
}
```

| Field | Description |
|-------|-------------|
| `success` | Always `false` |
| `error.code` | Machine-readable code |
| `error.message` | Human-readable message |
| `error.details` | Optional validation payload |
| `requestId` | Correlate with server logs |
| `message` | Duplicate of `error.message` (legacy compat) |

## Common codes

| HTTP | Code | When |
|------|------|------|
| 400 | `VALIDATION_ERROR` | Zod / body validation failed |
| 401 | `UNAUTHORIZED` | Missing or wrong `x-api-key` / JWT on protected mutation |
| 404 | `NOT_FOUND` | Entity missing |
| 409 | `CONFLICT` | Duplicate slug / public_id / invalid status transition |
| 429 | `RATE_LIMITED` | Too many mutation requests from one IP |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

Implementation: [`backend/src/lib/errors.ts`](../../backend/src/lib/errors.ts), [`backend/src/middleware/error-handler.ts`](../../backend/src/middleware/error-handler.ts).

## Frontend handling

```typescript
import { ApiError, isApiError } from "@/services/api/errors";

try {
  await catalogueApi.createFrame(payload);
} catch (e) {
  if (isApiError(e)) {
    console.log(e.status, e.message, e.code);
  }
}
```

## Success vs error

| Outcome | Body |
|---------|------|
| Catalogue CRUD success | Raw entity JSON (no `success: true` wrapper) |
| New M2 endpoints (list designs, recalculate pricing, validate clip) | `{ "data": …, "meta": { "requestId": "…" } }` |
| Health | `{ "status": "ok", "checks": { "database", "storage" } }` |
| Error | Envelope above |
