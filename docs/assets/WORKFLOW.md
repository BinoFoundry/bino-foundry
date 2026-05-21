# Asset workflow

How images flow from admin upload → Supabase Storage → catalogue rows → SPA.

## Storage buckets

| Bucket | Access | Purpose |
|--------|--------|---------|
| `frames` | Public read | Frame plates, masks, marketing |
| `crystals` | Public read | Bead / charm artwork |
| `assets` | Public read | UI art, admin uploads, previews |
| `uploads` | Private | Staging before promotion |

Created by migration `000002_storage_buckets_supabase.sql`.

Canonical path rules: [`database/storage/STORAGE_LAYOUT.md`](../../database/storage/STORAGE_LAYOUT.md).

Path builders (TypeScript): `@bino-foundry/shared` → `shared/src/storage/`.

## Upload API

| Endpoint | Flow | Admin UI |
|----------|------|----------|
| `POST /api/upload/staging` | Multipart `image` → private `uploads/{batch}/...` | **Media** section (`MediaManagerPage`) |
| `POST /api/upload` | Cloudinary **or** Supabase `assets` | `FrameForm`, `CrystalForm` image pickers |

Requires `x-api-key` when `ADMIN_API_KEY` is set (`VITE_ADMIN_API_KEY` in SPA).

### Staging query

```
POST /api/upload/staging?batch=admin
```

Response (typical):

```json
{
  "provider": "supabase",
  "bucket": "uploads",
  "objectKey": "admin/2025/…/file.png",
  "publicUrl": null
}
```

The admin **Media** page keeps a **session list** (browser state) with copy-to-clipboard for `objectKey` or `publicUrl`. Attach keys to SKUs in forms or future promotion UI.

## Admin flows (Phase 1)

### Media manager

1. Open `/admin` → **Media**
2. Set batch name (default `admin`)
3. Upload one or more images → `uploadApi.uploadStaging(file, batch)`
4. Copy object key / URL for use in catalogue fields

### Form uploads (public URL)

1. In **Frames** or **Crystals** edit form, pick image file
2. `POST /api/upload` → returns `imageUrl` (Cloudinary or `assets` bucket)
3. Save entity with URL in `frameImages` / `image`

### Sunglasses config

No file upload — lens tints use hex gradients in DB; frame colours use `hex` swatches.

## Promotion pattern (Phase 1)

1. Upload → staging or public `assets` URL.
2. Reference URL or key in frame/crystal JSON (`frameImages`, `image`, `marketing_copy` / `specs`).
3. SPA reads public URL from catalogue API.

**Preferred long-term:** `assets` row + FK (`frame_media`, `crystals.primary_image_asset_id`). Admin promotion UI is a follow-up.

## Sunglasses render assets

| Mode | Assets |
|------|--------|
| **customiser-dynamic** | SVG compositor — no tint raster required |
| **catalogue** | Optional `frameImages[]`, lens swatch URLs from DB |

Per-frame tint plates: `frames/{slug}/tints/{tint_code}.ext` aligned with `frame_lens_tints.tint_code`.

## Immutable keys

Do **not** overwrite production object keys. Upload a **new key** and update DB references.

## Cloudinary vs Supabase

| Config | Upload destination |
|--------|---------------------|
| `CLOUDINARY_*` set | Cloudinary (legacy `POST /upload`) |
| Supabase only | Public `assets` under `ui/admin/...` |

## Environment

- API: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Optional: `CLOUDINARY_*`
- Admin mutations: `ADMIN_API_KEY` + `VITE_ADMIN_API_KEY`

## Related

- [Admin architecture](../architecture/ADMIN.md)
- [Database setup](../setup/DATABASE.md)
- [Storage checklist](../MILESTONE1_STORAGE_CHECKLIST.md)
- [Upload module](../../backend/src/modules/upload/upload.service.ts)
- [api/ENDPOINTS.md](../api/ENDPOINTS.md)
