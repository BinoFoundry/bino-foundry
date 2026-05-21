## Milestone 1 · Storage foundation

- **Buckets** (`000002_storage_buckets_supabase.sql`): `frames`, `crystals`, `assets` (**public read**); `uploads` (**private**).
- **Path layout**: [`database/storage/STORAGE_LAYOUT.md`](../database/storage/STORAGE_LAYOUT.md) — immutable keys, tiered folders (preview/thumbnail/render cache).
- **Helpers**: `@bino-foundry/shared/storage` — kebab asserts, deterministic object keys (`uploadStagingObjectKey`, frame/crystal/assets builders).
- **Backend integration**: `@supabase/supabase-js` + service-role singleton; staging upload → `POST /api/upload/staging` or `/api/v1/upload/staging` with `batch` query (default `default`).
- **Promotion**: [`promoteCatalogObject`](../backend/src/infra/storage/catalog-object-storage.ts) stream-copy `uploads` → catalogue buckets (Postgres asset row linkage is a separate milestone slice).
- **Public URLs**: `getPublicUrl` only for catalogue buckets (`publicCatalogHttpUrl`); never expose `uploads/*` URLs in PDP.

### Verify locally

1. Apply `database/migrations/000002_storage_buckets_supabase.sql` on the linked Supabase project.
2. Set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `.env`.
3. `npm install` at repo root; `npm run build -w backend` then `multipart` POST staging route with configured `ADMIN_API_KEY` header if mutations are guarded.
