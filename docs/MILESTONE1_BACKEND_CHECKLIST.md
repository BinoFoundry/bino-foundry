# Milestone 1 — Backend foundation (completed)

Express API with modular domains and Supabase integration.

## Delivered

| Deliverable | Status |
|-------------|--------|
| TypeScript API (`tsx` dev, `tsc` → `dist/`) | Done |
| Zod-validated env (`config/env.ts`, multi-path `.env`) | Done |
| Layered `modules/*` (validation · service · controller · routes) | Done |
| HTTP helpers (`errors`, `http-response`, `validation`, `async-handler`) | Done |
| Middleware: request id, CORS, mutation API key, multipart, global errors | Done |
| Dual mount `/api` + `/api/v1` | Done |
| Route factories (no duplicate handlers per version) | Done |
| Supabase Postgres client (service role) | Done |
| Supabase Storage staging + promotion helpers | Done |
| OpenAPI + Swagger at `/api/docs` | Done |

## API modules (Phase 1)

| Module | Role |
|--------|------|
| `frames`, `crystals`, `types` | Catalogue CRUD |
| `sunglasses` | Builder catalog (tints, options) |
| `rendering` | Frame render views + clip config |
| `upload` | Staging (Supabase; Cloudinary optional legacy) |
| `bead-libraries`, `bead-types` | Unified bead catalogue |
| `bead-sizes` | Admin-managed bracelet bead sizes |
| `charms`, `charm-types`, `spacers`, `spacer-types` | Bracelet catalogue |
| `bracelet` | Pricing rules + save configurations |

## Auth model (M1)

- Optional `ADMIN_API_KEY` on **mutations** (`x-api-key` or Bearer)
- GET catalogue routes open for SPA builders in dev
- No end-user JWT / session (M2)

## Verify

```bash
npm run dev:backend
curl http://localhost:5050/api/status
open http://localhost:5050/api/docs
```

Smoke: `GET /api/bead-libraries`, `GET /api/bracelet/pricing-rules`, `GET /api/sunglasses/...` (see [ENDPOINTS.md](./api/ENDPOINTS.md)).

## Milestone 2

JWT auth, unified response envelope, full repository layer, orders/checkout APIs — [MILESTONE2_BACKEND_CHECKLIST.md](./MILESTONE2_BACKEND_CHECKLIST.md).
