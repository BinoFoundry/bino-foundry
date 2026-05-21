# Milestone 1 — Database setup

| Deliverable | Location |
|-------------|----------|
| Initial Postgres catalog schema for Supabase | [`database/migrations/000001_initial_catalog.sql`](../database/migrations/000001_initial_catalog.sql) |
| Conventions · enum strategy · pricing notes | [`database/schema/CONVENTIONS.md`](../database/schema/CONVENTIONS.md) |
| How to apply migrations | [`database/migrations/README.md`](../database/migrations/README.md) |

| Area | Covered |
|------|---------|
| Entities / tables | `assets`, `config_kv`, `crystal_types`, `crystals`, `frames`, `frame_media`, `frame_lens_tints`, `collection_tags`, `collection_tag_links` |
| Relationships | FK graph in migration + ASCII summary in conventions doc |
| Product ↔ asset linkage | FK to `assets` + optional URLs in metadata |
| Pricing / configuration | Numeric columns + `config_kv` JSON payloads |
| Indexes | B-tree FK paths, partials for soft filters (`is_active`), storage prefix search |
| Triggers | `touch_updated_at()` on mutable catalog tables |

Intentionally deferred: Supabase **RLS** (enable after JWT auth wiring), transactional inventory/e-commerce tables.
