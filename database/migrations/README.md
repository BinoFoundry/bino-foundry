## Supabase migrations

SQL in this folder is **Postgres-compatible** (Supabase = managed Postgres).

### Applying

**Option A · Supabase Dashboard**

1. Open **SQL Editor** → paste [`000001_initial_catalog.sql`](./000001_initial_catalog.sql) → run.

**Option B · Supabase CLI** (recommended for CI)

```bash
supabase login
supabase link --project-ref <ref>
supabase db push   # after placing files under supabase/migrations/, or pipe manually
```

**Option C · `psql`**

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/000001_initial_catalog.sql
```

### Order

1. `000001_initial_catalog.sql` — extensions, enums-as-check constraints, catalogue + assets + tagging + pricing KV.
2. `000002_storage_buckets_supabase.sql` — **Supabase-hosted only** (`storage.buckets` + anon SELECT policies for public catalogue buckets). Skip on plain Postgres installs.
3. `000003_sunglasses_builder_catalog.sql` — lens tints, builder options (polarised / prescription), frame colour swatches + disclaimer KV.
4. `000004_frame_render_views.sql` — per-frame front/side plates + polygon lens `mask_config` JSON.
5. `000005_drop_sunglasses_frame_colors.sql` — remove deprecated frame colour swatch table.
6. `000006_bracelet_charms_spacers.sql` — charms + spacers catalogue tables and dedicated type systems (`charm_types`, `spacer_types`).
7. `000007_unified_bead_libraries.sql` — **`bead_types`** + **`bead_libraries`** (unified API); migrates existing crystals/charms/spacers rows. Legacy tables remain for rollback.
8. `000008_svg_lens_clip_config.sql` — **`clip_config`** / **`clip_status`** on `frame_render_views`; adds `three_quarter` view axis. Sunglasses tint uses SVG clip paths (replaces canvas mask bitmap workflow for new saves).
9. `000009_bracelet_configurations.sql` — saved bracelet designs (`bracelet_configurations`, `bracelet_configuration_items`); seeds `bracelet.pricing_v1` in `config_kv`.
10. `000010_bead_sizes.sql` — admin-managed bead sizes (`bead_sizes`) for slot capacity and pricing multipliers.

Further layout semantics live at [`database/storage/STORAGE_LAYOUT.md`](../storage/STORAGE_LAYOUT.md).

Milestone docs: apply all ten before M1 sign-off — [docs/MILESTONE1_SIGNOFF.md](../../docs/MILESTONE1_SIGNOFF.md).

### Naming & money rules

See [../schema/CONVENTIONS.md](../schema/CONVENTIONS.md).

### Row Level Security

Phase 1 ships **without** RLS policies: the Express backend will use the **service role** for writes and can narrow access later. Enable RLS in a future migration once auth is tied to Supabase JWT.
