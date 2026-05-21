# Database setup (Supabase Postgres)

The API uses **Supabase as managed Postgres** via the service role (PostgREST). There is no MongoDB in Phase 1.

## Migrations

Location: [`database/migrations/`](../../database/migrations/)

| File | Purpose |
|------|---------|
| `000001_initial_catalog.sql` | Core catalogue: `frames`, `crystals`, `crystal_types`, `assets`, `frame_lens_tints`, tags, `config_kv` |
| `000002_storage_buckets_supabase.sql` | Storage buckets + public read policies (`frames`, `crystals`, `assets`, `uploads`) |
| `000003_sunglasses_builder_catalog.sql` | Sunglasses builder: lens tints, options (polarised/prescription), frame colours |

### Apply (Supabase Dashboard)

1. Project → **SQL Editor**
2. Paste each file **in order** → Run

### Apply (`psql`)

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/000001_initial_catalog.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/000002_storage_buckets_supabase.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/000003_sunglasses_builder_catalog.sql
```

## After migrate

Backend startup calls `verifySupabaseCatalogReady()` — pings `crystal_types` and `sunglasses_lens_tints`.

## Conventions

- Money: `NUMERIC(14,4)` on price columns
- IDs: UUID surrogates; stable slugs (`frames.slug`, `crystals.public_id`, `sunglasses_lens_tints.code`)
- Details: [`database/schema/CONVENTIONS.md`](../../database/schema/CONVENTIONS.md)

## Storage

Bucket layout: [`database/storage/STORAGE_LAYOUT.md`](../../database/storage/STORAGE_LAYOUT.md)

## Row Level Security

Phase 1: **no RLS** on app tables. The Express API uses the **service role** server-side. Enable RLS in a later milestone when the SPA uses Supabase JWT directly.

## Related

- [Asset workflow](../assets/WORKFLOW.md)
- [Environment](../environment/README.md) — `SUPABASE_*` vars
