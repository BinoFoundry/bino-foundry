# Milestone 1 — Sign-off summary

**Status:** Foundation complete · ready to close M1 and begin [Milestone 2](./MILESTONE2_OVERVIEW.md).

Milestone 1 delivered **architecture and working foundations**, not final visual quality, premium UX, or e-commerce. Several builder improvements landed during M1 implementation; they are documented here as **foundation extensions** and further polish is tracked under Milestone 2.

## Agreed M1 scope (source of truth)

| Area | Intent |
|------|--------|
| Project structure | Monorepo: `frontend/`, `backend/`, `shared/`, `database/`, `docs/`, `deploy/` |
| Backend foundation | Express API, modules, env, errors, API key gate, Supabase data access |
| Database | Postgres catalog on Supabase, migrations, conventions |
| Storage | Buckets, path layout, staging upload, promotion helpers |
| Frontend foundation | SPA shell, API client, state, layouts, builder routes |
| Rendering foundation | Layered 2D engine, sunglasses customiser, SVG clip pipeline |
| Admin foundation | Dashboard, product CRUD surfaces, media staging, clip editors |
| Deploy / env | Docker, VPS, Vercel, CI, health checks, env templates |

**Explicitly out of M1:** full e-commerce, 3D/WebGL, production-grade visual realism, premium UI polish, route-level admin auth (JWT).

## Checklist index

| Doc | Topic |
|-----|--------|
| [Structure](./MILESTONE1_STRUCTURE_CHECKLIST.md) | Monorepo |
| [Database](./MILESTONE1_DATABASE_CHECKLIST.md) | SQL + migrations |
| [Backend](./MILESTONE1_BACKEND_CHECKLIST.md) | Express API |
| [Storage](./MILESTONE1_STORAGE_CHECKLIST.md) | Supabase Storage |
| [Frontend](./MILESTONE1_FRONTEND_CHECKLIST.md) | SPA + builders |
| [Render](./MILESTONE1_RENDER_CHECKLIST.md) | Sunglasses + SVG clip |
| [Admin](./MILESTONE1_ADMIN_CHECKLIST.md) | Admin dashboard |
| [Deploy](./MILESTONE1_DEPLOY_CHECKLIST.md) | Environment & deployment |
| [Docs](./MILESTONE1_DOCS_CHECKLIST.md) | Documentation set |

## Foundation extensions (delivered during M1, beyond initial checklists)

These were implemented to make foundations **usable**, not to complete Milestone 2 polish.

| Extension | Location |
|-----------|----------|
| Supabase-backed API (replacing legacy Mongo path) | `backend/src/infra/supabase/`, module services |
| SVG lens clip rendering + DB `clip_config` | `000008`, `frontend/src/render/lens-clip/`, `SvgClipCompositorView` |
| Polygon clip editor (frames + bead crop) | `PolygonEditor`, `FrameMaskEditor`, `BeadCropEditor` |
| Frame render views API | `backend/src/modules/rendering/` |
| Unified bead libraries + charms/spacers | `000006`, `000007`, `bead-libraries` module |
| Bracelet configurations + pricing API | `000009`, `backend/src/modules/bracelet/` |
| Admin-managed bead sizes | `000010`, `bead-sizes` module, admin page |
| Bracelet builder feature module | `frontend/src/features/bracelet/`, `BraceletBuilder` |
| Strand guide, cord, zoom/pan, twin duplicate | `SortableCircularStrand`, `useStrandZoom` |

## Deferred to Milestone 2

See [MILESTONE2_OVERVIEW.md](./MILESTONE2_OVERVIEW.md). Summary:

- Tint / compositing **realism** and highlight quality
- **Premium** builder and admin UI
- Full **bracelet configurator** product experience
- Admin **full API sync**, promotion UI, `config_kv` editor
- **Auth** (admin routes + RLS/JWT)
- **Checkout** and order flow preparation
- Clip editor UX depth (ergonomics beyond foundation undo/redo)

## Sign-off verification (run before client handoff)

```bash
# From repo root
npm ci
npm run env:check
npm run build:all
npm run test
```

| Check | How |
|-------|-----|
| API health | `curl http://localhost:5050/api/status` after `npm run dev:backend` |
| Swagger | http://localhost:5050/api/docs |
| SPA | `npm run dev` → `/sunglasses`, `/bracelet`, `/admin` |
| Sunglasses flow | [MILESTONE1_RENDER_CHECKLIST.md](./MILESTONE1_RENDER_CHECKLIST.md) verify steps |
| Migrations | Apply `000001`–`000010` per [database/migrations/README.md](../database/migrations/README.md) |
| Staging upload | POST `/api/upload/staging` with `x-api-key` when `ADMIN_API_KEY` set |

## Known limitations (accepted for M1)

- Admin frames/crystals/types may use hybrid local + API catalogue state
- No SPA route guard on `/admin` (API key on mutations only)
- No RLS on Postgres tables (service role via backend)
- Checkout button disabled / manual prescription follow-up only
- Cloudinary may still be configured as legacy upload fallback

## Recommendation

**Milestone 1 can be signed off** when migration apply + verification above pass and no blocking regressions remain in SVG clip load/edit or sunglasses builder stability. All visual and UX excellence targets move to **Milestone 2**.
