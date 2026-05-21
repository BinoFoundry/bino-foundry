# Frontend architecture

Package: `@bino-foundry/frontend` (Vite + React + TypeScript).

## Layered structure

```
src/
├── main.tsx, App.tsx          # Bootstrap, routing
├── pages/                     # Route shells (Index → modules)
├── layouts/                   # AppShell, BuilderViewport
├── providers/                 # React Query, catalogue, sunglasses catalog, render
├── config/                    # VITE_* resolution (api base URL)
├── services/api/              # apiRequest, catalogueApi, sunglassesApi, uploadApi
├── state/
│   ├── catalogue/             # CatalogueProvider (frames, crystals, types)
│   └── sunglasses-catalog/    # Lens tints, options, frame colours from API
├── features/
│   ├── sunglasses/            # Customiser flow (Frame → Lens → Options → Preview)
│   └── admin/                 # AdminApp, layout, product/pricing/media modules
├── render/                    # Compositor, layers, pricing helpers
├── components/                # Builders, admin forms, ui/ (shadcn)
├── data/                      # Static defaults, legacy re-exports → state/catalogue
├── types/                     # TS contracts
└── lib/                       # Utilities, luxe-data adapters
```

## Data flow

1. **Hydrate** — `CatalogueProvider` + `SunglassesCatalogProvider` fetch from API on mount.
2. **Builders** — Read catalogue + sunglasses catalog state; render via `render/`.
3. **Admin** — Section router in `features/admin/AdminApp`; product pages use catalogue state; pricing uses sunglasses API; media uses staging upload.
4. **Render** — Sunglasses preview uses `SunglassesCompositor` with `renderMode: "customiser-dynamic"`.

## Routing

Module routes via React Router in `pages/Index.tsx`:

| Path | Module |
|------|--------|
| `/bracelet` | Bracelet builder |
| `/sunglasses` | Sunglasses customiser |
| `/admin` | `AdminApp` |

## Admin module

See [ADMIN.md](./ADMIN.md) and [`features/admin/README.md`](../../frontend/src/features/admin/README.md).

```
features/admin/
├── AdminApp.tsx
├── navigation.ts              # Sidebar groups
├── components/                # AdminLayout, AdminToolbar, …
├── hooks/                     # useAdminList, useImageUpload
├── forms/                     # Re-exports FrameForm, CrystalForm, TypeForm
└── modules/
    ├── dashboard/
    ├── products/              # frames, crystals, types
    ├── pricing/               # SunglassesPricingPage
    └── media/                 # MediaManagerPage
```

## Configuration

Build-time via Vite:

- `VITE_API_BASE_URL` — API origin
- `VITE_API_PREFIX` — default `/api`
- `VITE_ADMIN_API_KEY` — `x-api-key` on mutations (admin + forms)

See [environment/README.md](../environment/README.md).

## Render engine

[`frontend/src/render/README.md`](../../frontend/src/render/README.md).

- **customiser-dynamic** — lens-only gradient + vector frame
- **catalogue** — optional raster plates from frame assets

## Testing

- **Vitest** — `src/test/`
- **Playwright** — `frontend/playwright.config.ts`

## Related

- [Development workflow](../development/WORKFLOW.md)
- [API client usage](../api/README.md)
- [Admin architecture](./ADMIN.md)
