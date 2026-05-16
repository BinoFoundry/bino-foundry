# Database conventions (PostgreSQL / Supabase)

## Naming

| Layer | Convention | Example |
|-------|-------------|---------|
| Schema | `public` for app tables | `public.frames` |
| Tables | plural `snake_case` | `frame_lens_tints` |
| Primary key | surrogate `id` (`uuid`) everywhere | |
| Logical / API keys | explicit column | `crystals.public_id`, `frames.slug`, `frame_lens_tints.tint_code` |
| Foreign keys | `<referenced_singular>_id` | `crystal_type_id` |
| Booleans | `is_*`, `has_*` | `is_active` |
| Timestamps | `created_at`, `updated_at` (`timestamptz`) | UTC |

Surrogate UUIDs isolate storage paths and public URLs from mutable marketing names.

## Money

- Columns use **`NUMERIC(14, 4)`** (`unit_price`, `base_price`) to avoid floating error and allow micro-adjustments / FX if needed later.
- Optional `currency_code` (`CHAR(3)` pattern) defaults to `USD`; multi-currency pricing can move to a `price_list` table later without breaking Phase 1.

## Configuration vs hard-coded rules

- **`config_kv`**: small JSON documents for tunable numbers/flags (e.g. builder defaults, feature toggles). Keep **high-cardinality or relational** data in real tables, not JSON.
- **`specs` / `marketing_copy` / `display_metadata`**: JSONB for **non-query-critical** attributes; index with expression indexes only when search needs it.

## Storage ↔ rows

- **`assets`** is the canonical join between Postgres metadata and Supabase Storage objects (`bucket`, `object_key`).
- Prefer **foreign keys into `assets`** over raw URL strings for anything long-lived (enables swaps, versioning via `derived_from_asset_id`).
- Short-lived URLs (signed) can still be persisted in `public_url` when buckets are private; regenerate from `bucket`/`object_key` when possible.

## Enumerations strategy

Phase 1 uses **`TEXT … CHECK (... IN (...))`** for small closed sets (`bucket`, media `role`). This avoids `ALTER TYPE ... ADD VALUE` deployment friction while staying stricter than free text.

When a family stabilizes (>12 values, reused across modules), promote to Postgres `ENUM` via a dedicated migration after a freeze window.

## Indexing posture

- Every **FK column** participates in queries → btree index declared explicitly where default planner might miss selective paths.
- **Partial indexes** (`WHERE is_active`) keep hot paths small until soft-delete policies change.

## Relational boundaries

```
crystal_types 1 ── * crystals
frames 1 ── * frame_media ── * assets
frames 1 ── * frame_lens_tints ── * assets
collection_tags * ── * frames | crystals (via collection_tag_links)
```

No inventory / stock deductions in Phase 1 (builder-only SKU catalogue).
