# Milestone 1 — Storage foundation (completed)

Supabase Storage for catalogue assets and private staging.

## Delivered

- **Buckets** (`000002_storage_buckets_supabase.sql`): `frames`, `crystals`, `assets` (public read); `uploads` (private).
- **Path layout**: [`database/storage/STORAGE_LAYOUT.md`](../database/storage/STORAGE_LAYOUT.md) — frames, crystals, bracelet beads/charms/spacers, previews.
- **Shared helpers**: `@bino-foundry/shared` — `uploadStagingObjectKey`, catalogue key builders.
- **Backend**: service-role client; `POST /api/upload/staging` (+ `/api/v1/...`).
- **Promotion**: `promoteCatalogObject` — stream copy `uploads` → catalogue bucket (asset row linkage still partial).
- **Public URLs**: catalogue buckets only; never expose private `uploads/*` in builders.

## Bracelet asset paths (documented)

```
bracelets/beads/{crystal_public_id}@{density}.{ext}
bracelets/charms/{charm_id}.{ext}
bracelets/spacers/{spacer_id}.{ext}
```

Bead **crop** processed assets referenced via `bead_libraries` metadata / asset FKs.

## Verify

1. Apply `000002` on Supabase project.
2. Set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `.env`.
3. `npm run build -w backend`
4. Upload test file to staging with `x-api-key` when `ADMIN_API_KEY` is set.
5. Confirm object under `uploads/yyyy/mm/batch/...` in Supabase Storage UI.

## Milestone 2

- Admin UI: promote staging → catalogue with `assets` row creation
- Render-cache tier usage
- Deprecate Cloudinary-only path where Supabase is primary

See [MILESTONE2_ADMIN_CHECKLIST.md](./MILESTONE2_ADMIN_CHECKLIST.md) and [assets/WORKFLOW.md](./assets/WORKFLOW.md).
