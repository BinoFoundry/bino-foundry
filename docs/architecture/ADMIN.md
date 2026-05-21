# Admin architecture

Phase 1 admin UI for catalogue products, sunglasses builder pricing, and media staging.

## Entry point

| Item | Location |
|------|----------|
| Route | `/admin` (React Router in `pages/Index.tsx`) |
| Root component | `features/admin/AdminApp.tsx` |
| Legacy import | `components/admin/CatalogueAdmin.tsx` → re-exports `AdminApp` |

No route-level auth in Phase 1. Protect mutations with `ADMIN_API_KEY` on the API and `VITE_ADMIN_API_KEY` in the SPA.

## Layout

```
AdminApp
├── AdminLayout          # Header, sidebar (md+), reset local cache
├── AdminMobileNav       # Section select on small screens
└── AdminSectionView     # Switches module page by section id
```

### Sections

| Section id | Module | Data source |
|------------|--------|-------------|
| `dashboard` | `modules/dashboard/AdminDashboardPage` | Counts from catalogue + sunglasses state |
| `frames` | `modules/products/FramesAdminPage` | `useCatalogue()` frames |
| `crystals` | `modules/products/CrystalsAdminPage` | `useCatalogue()` crystals |
| `types` | `modules/products/TypesAdminPage` | `useCatalogue()` types |
| `pricing` | `modules/pricing/SunglassesPricingPage` | `useSunglassesCatalog()` + API CRUD |
| `media` | `modules/media/MediaManagerPage` | `POST /api/upload/staging` |

Navigation config: `features/admin/navigation.ts` (`ADMIN_NAV_ITEMS`, grouped sidebar).

## Reusable UI

Under `features/admin/components/`:

| Component | Role |
|-----------|------|
| `AdminToolbar` | Search, add, back, title slot |
| `AdminPage` | Scrollable content + optional footer |
| `AdminListRow` | Clickable list row |
| `AdminDeleteConfirm` | Inline delete confirmation |
| `AdminEmptyState` | Empty list placeholder |
| `AdminFormShell` | Form footer (cancel / save) |
| `AdminCatalogRow` | API-backed entity row (pricing module) |
| `AdminSectionTabs` | Sub-tabs within a page |

Hooks:

- `useAdminList` — search filter + delete confirmation state
- `useImageUpload` — public upload + staging via `uploadApi`

## Forms

Entity editors live in `components/admin/` (`FrameForm`, `CrystalForm`, `TypeForm`) and are re-exported from `features/admin/forms/`.

Sunglasses pricing uses inline editors inside `components/admin/SunglassesCatalogAdmin.tsx` (wrapped by `SunglassesPricingPage`).

## Data flow (Phase 1)

```
┌─────────────────────────────────────────────────────────────┐
│  Admin UI (features/admin)                                   │
├─────────────────────────────────────────────────────────────┤
│  Frames / Crystals / Types  →  CatalogueProvider            │
│    · localStorage snapshot + defaults                        │
│    · API hydration on mount (when backend catalogue wired)   │
├─────────────────────────────────────────────────────────────┤
│  Sunglasses config  →  SunglassesCatalogProvider             │
│    · GET /sunglasses/catalog/admin                           │
│    · POST/PUT/DELETE + x-api-key                             │
├─────────────────────────────────────────────────────────────┤
│  Media  →  uploadApi.uploadStaging(file, batch)              │
│    · Session list in component state only                    │
└─────────────────────────────────────────────────────────────┘
```

## API mapping (admin actions)

| Admin action | API |
|--------------|-----|
| Edit lens tint / option / colour | `/sunglasses/lens-tints`, `/options`, `/frame-colors` |
| Stage image | `POST /upload/staging?batch=` |
| Public image on form | `POST /upload` (Cloudinary or `assets` bucket) |
| Frames/crystals/types (future) | `/frames`, `/crystals`, `/types` |

See [api/ENDPOINTS.md](../api/ENDPOINTS.md) and [assets/WORKFLOW.md](../assets/WORKFLOW.md).

## Related

- [MILESTONE1_ADMIN_CHECKLIST.md](../MILESTONE1_ADMIN_CHECKLIST.md)
- [Frontend architecture](./FRONTEND.md)
- [Development workflow](../development/WORKFLOW.md)
