# Admin feature (`features/admin`)

Modular admin dashboard for Phase 1. Imported by the app via `AdminApp`; `components/admin/CatalogueAdmin` re-exports for backward compatibility.

## Run locally

1. `npm run dev:backend` and `npm run dev`
2. Open http://localhost:8080/admin
3. Set matching keys for API mutations:

```env
# .env
ADMIN_API_KEY=dev-secret

# frontend/.env.development.local
VITE_ADMIN_API_KEY=dev-secret
```

## Structure

```
features/admin/
├── AdminApp.tsx           # Section router
├── navigation.ts          # Sidebar groups + labels
├── types.ts
├── components/            # Layout, toolbar, list, forms shell
├── hooks/                 # useAdminList, useImageUpload
├── forms/                 # Re-exports FrameForm, CrystalForm, TypeForm
├── crud/types.ts          # Shared CRUD TypeScript helpers
└── modules/
    ├── dashboard/
    ├── products/          # frames, crystals, types
    ├── pricing/           # SunglassesPricingPage
    └── media/             # MediaManagerPage
```

## Adding a section

1. Add `AdminSection` id in `types.ts`
2. Add nav item in `navigation.ts`
3. Create page under `modules/`
4. Wire case in `AdminApp.tsx` → `AdminSectionView`
5. Update [docs/architecture/ADMIN.md](../../../../docs/architecture/ADMIN.md)

## Docs

- [docs/architecture/ADMIN.md](../../../../docs/architecture/ADMIN.md)
- [docs/MILESTONE1_ADMIN_CHECKLIST.md](../../../../docs/MILESTONE1_ADMIN_CHECKLIST.md)
