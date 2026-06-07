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
11. `000015_bracelet_per_item_sizing.sql` — optional `default_bead_size_mm` (placement hint); per-item `bead_size_mm` is source of truth for fit.
12. `000016_bead_variants.sql` — `bead_variants` (legacy; superseded by 000017).
13. `000017_bead_library_sizes.sql` — `bead_library_sizes` junction (library × global `bead_sizes` + per-size price); migrates variants; drops `bead_variants`.
14. `000018_wrist_sizes.sql` — admin-managed wrist targets (`wrist_sizes`); relaxes saved-config wrist CHECK constraints.
15. `000019_wrist_sizes_notes.sql` — optional `notes` on `wrist_sizes`.
16. `000020_bead_size_only_pricing.sql` — drop `bead_libraries.unit_price`; pricing only in `bead_library_sizes`.
17. `000021_bead_size_decimal_positive.sql` — `bead_sizes.size_mm` and saved config items use `NUMERIC(10,4)` with `> 0` only (no 4–24 mm cap).
18. `000022_remove_size_multipliers.sql` — drop `bead_sizes.price_multiplier`, `bead_types.uses_size_pricing`, and legacy `bracelet.pricing_v1` config.

Further layout semantics live at [`database/storage/STORAGE_LAYOUT.md`](../storage/STORAGE_LAYOUT.md).

M1 sign-off: migrations through `000010`. M2 launch: also apply `000011`–`000014` — [docs/MILESTONE2_OVERVIEW.md](../../docs/MILESTONE2_OVERVIEW.md).

### Naming & money rules

See [../schema/CONVENTIONS.md](../schema/CONVENTIONS.md).

11. `000011_site_settings.sql` — site-wide settings KV (`site.settings_v1`).
12. `000012_bead_type_size_pricing.sql` — `bead_types.uses_size_pricing`.
13. `000013_lens_tint_render_settings.sql` — tint opacity/gradient columns.
14. `000014_auth_rls_m2.sql` — catalogue **RLS** (anon read-only), bracelet `owner_user_id` / `order_reference`.

### Row Level Security

Migration **`000014_auth_rls_m2.sql`** enables RLS on catalogue tables: `anon` / `authenticated` may **SELECT** active rows; **writes** go through the Express API with the **service role** only. See [docs/MILESTONE2_AUTH.md](../../docs/MILESTONE2_AUTH.md).

### CI/CD

```bash
# Apply all migrations in order (example)
for f in database/migrations/000*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done
```

Or `supabase db push` after linking the project.
