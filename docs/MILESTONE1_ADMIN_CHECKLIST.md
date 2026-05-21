# Milestone 1 — Admin dashboard foundation

Phase 1 admin UI: modular layout, product CRUD surfaces, pricing/config, and media staging.

## Structure

| Path | Purpose |
|------|---------|
| `frontend/src/features/admin/` | Admin feature module (layout, hooks, pages) |
| `frontend/src/features/admin/AdminApp.tsx` | Root shell + section routing |
| `frontend/src/features/admin/components/` | Reusable admin UI (toolbar, list row, forms shell) |
| `frontend/src/features/admin/modules/products/` | Frames, crystals, types |
| `frontend/src/features/admin/modules/pricing/` | Sunglasses builder config (API) |
| `frontend/src/features/admin/modules/media/` | Staging upload session |
| `frontend/src/components/admin/*Form.tsx` | Entity forms (re-exported via `features/admin/forms`) |

## Sections

- [x] Dashboard — counts + quick navigation
- [x] Frames — list, detail, create/edit (`FrameForm`)
- [x] Crystals — list + modal CRUD (`CrystalForm`)
- [x] Types — list + modal CRUD (`TypeForm`)
- [x] Sunglasses config — lens tints, options, frame colours (existing `SunglassesCatalogAdmin`)
- [x] Media — batch staging uploads via `POST /upload/staging`

## Integration

- Route: `/admin` via `pages/Index.tsx` → `CatalogueAdmin` re-exports `AdminApp`
- Catalogue state: `@/state/catalogue` (`useCatalogue`)
- Sunglasses pricing: `@/state/sunglasses-catalog` + `VITE_ADMIN_API_KEY` for mutations
- No Phase 1 route auth; protect API with `ADMIN_API_KEY`

## Documentation

- [architecture/ADMIN.md](./architecture/ADMIN.md)
- [frontend/src/features/admin/README.md](../frontend/src/features/admin/README.md)
- Cross-linked from [api/ENDPOINTS.md](./api/ENDPOINTS.md), [assets/WORKFLOW.md](./assets/WORKFLOW.md)

## Follow-ups (post–Phase 1)

- [ ] Wire frames/crystals/types to backend catalogue API (replace local-only store)
- [ ] Auth gate for `/admin`
- [ ] Promote staging assets to catalogue paths from admin UI
- [ ] Shared `config_kv` editor in admin
