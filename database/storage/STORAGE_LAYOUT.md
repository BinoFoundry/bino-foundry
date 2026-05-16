# Supabase Storage layout

Buckets are coarse boundaries; folders carry meaning. Prefer **immutable object keys**: when media changes, upload a **new key** (and bump `derived_from_asset_id` in Postgres) instead of overwriting.

Canonical bucket ids: `frames`, `crystals`, `assets`, `uploads` (mirror [`shared/src/constants/index.ts`](../../shared/src/constants/index.ts)).

## `frames` (public read)

Optimized for Sunglasses renderer: base plates, layering masks, marketing stills.

Keys are relative to the `frames` bucket (do not duplicate the bucket name in each key):

```
{frame_slug}/base/{slot}.{ext}
{frame_slug}/layers/lens-mask.{ext}
{frame_slug}/tints/{tint_code}.{ext}
{frame_slug}/marketing/{rank}_{descriptor}.{ext}
```

| Path segment | Purpose |
|----------------|---------|
| `base/` | Front-on hero used when tint is neutral / picker idle |
| `layers/lens-mask` | Alpha mask for constrained tint composites |
| `tints/` | Pre-authored tint composites (preferred) or overlays |
| `marketing/` | Non-interactive carousel art |

`tint_code` matches `frame_lens_tints.tint_code` (lowercase `kebab-case`).

## `crystals` (public read)

Bracelet builder beads, charms (if rasterized later), spacer artwork.

Keys relative to the `crystals` bucket:

```
bracelets/beads/{crystal_public_id}@{density}.{ext}
bracelets/charms/{charm_id}.{ext}
bracelets/spacers/{spacer_id}.{ext}
```

Suffix `@2x`, `@3x` optional (`crystal_public_id@2x.png`). Keep **baseline** `{id}.png`.

## `assets` (public read)

Derived marketing + cached previews unrelated to strict SKU lineage.

Keys relative to the `assets` bucket:

```
previews/frame/{slug}/{preset_key}.webp
thumbnails/crystal/{crystal_public_id}_thumb.webp
ui/{component}/{asset}.webp
renders/{render_job_id}/{layer_stack_hash}.webp
```

Under **`renders/`**: server/job composited previews; TTL and eviction via housekeeping jobs.

## `uploads` (private)

Staging before catalog promotion (admin multipart → validate → virus scan stub → promote copy into `frames`/`crystals`/`assets`).

Keys relative to the `uploads` bucket:

```
{yyyymm}/{upload_batch}/{uuid_original_name_sanitized}
```

Never hotlink `uploads/*` directly in production PDP.

## Naming rules

1. **`frame_slug`** / **`tint_code`** / **`public_id`** — lowercase **`[a-z0-9]+(-[a-z0-9]+)*`**.  
2. File stem mirrors semantic role (`lens-mask`, not `IMG_0842`).  
3. Prefer **webp** derived from lossless PNG masters offline; keep PNG for transparency-critical masks until tooling lands.  
4. **No query strings inside keys**: cache bust via filename version (`hero.v2.webp`).

## Integration flow

1. Client → **Express** (API key protected) multipart `uploads/` write via **service role**.  
2. Worker/pipeline validates → duplicates object into **`frames`/`crystals`/`assets`** with Postgres `assets` row.  
3. SPA reads **public** URLs from **`getPublicUrl` / CDN** (`frames`, `crystals`, `assets`) or short-lived signed URL if tightening later.
