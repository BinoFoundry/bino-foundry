# Milestone 1 — Database setup (completed)

Postgres catalog on Supabase. Apply all migrations in order on each environment.

## Core deliverables

| Deliverable | Location |
|-------------|----------|
| Initial catalog schema | [`000001_initial_catalog.sql`](../database/migrations/000001_initial_catalog.sql) |
| Conventions | [`database/schema/CONVENTIONS.md`](../database/schema/CONVENTIONS.md) |
| Apply guide | [`database/migrations/README.md`](../database/migrations/README.md) |

## Migration index

| File | Purpose |
|------|---------|
| `000001` | Assets, crystals, types, frames, tags, `config_kv` |
| `000002` | Supabase Storage buckets + public read policies |
| `000003` | Sunglasses builder catalog (tints, options) |
| `000004` | `frame_render_views` (plates + mask/clip JSON) |
| `000005` | Drop deprecated sunglasses frame colours table |
| `000006` | Charms + spacers catalogue |
| `000007` | `bead_types`, `bead_libraries` (unified bead API) |
| `000008` | SVG `clip_config` on render views; `three_quarter` axis |
| `000009` | `bracelet_configurations` + items; pricing seed in `config_kv` |
| `000010` | `bead_sizes` (admin-managed mm + multipliers) |

## Tables by area

| Area | Tables |
|------|--------|
| Assets / config | `assets`, `config_kv` |
| Legacy crystals | `crystal_types`, `crystals` (still present; beads also in `bead_libraries`) |
| Frames / rendering | `frames`, `frame_media`, `frame_lens_tints`, `frame_render_views` |
| Sunglasses builder | `sunglasses_lens_tints`, `sunglasses_builder_options`, … (`000003`) |
| Bracelet catalogue | `bead_types`, `bead_libraries`, `charms`, `spacers`, … |
| Bracelet builder | `bracelet_configurations`, `bracelet_configuration_items`, `bead_sizes` |
| Tagging | `collection_tags`, `collection_tag_links` |

## Foundation characteristics

- FK graph + indexes + `touch_updated_at()` triggers on mutable tables
- Pricing via numeric columns + `config_kv` JSON (bracelet + sunglasses rules)
- **No RLS** in Phase 1 — backend uses service role (M2: JWT + RLS)

## Verify

1. Run migrations `000001`–`000010` on Supabase SQL editor or `psql`.
2. Confirm `config_kv` keys: sunglasses + `bracelet.pricing_v1`.
3. API lists beads: `GET /api/bead-libraries`, sizes: `GET /api/bead-sizes`.

## Milestone 2

E-commerce tables, RLS policies, inventory — see [MILESTONE2_BACKEND_CHECKLIST.md](./MILESTONE2_BACKEND_CHECKLIST.md).
