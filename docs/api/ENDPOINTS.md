# API endpoints

Base: `{origin}/api` or `{origin}/api/v1`

Legend: **R** = read (no API key). **W** = write (API key when `ADMIN_API_KEY` is set).

Machine-readable spec: `/api/openapi.json` · UI: `/api/docs` — [SWAGGER.md](./SWAGGER.md).

## Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/status` | R | Status + `appEnv` |
| GET | `/health` | R | Minimal liveness |

## Frames

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/frames` | R | List frames |
| GET | `/frames/:id` | R | Get frame (UUID) |
| POST | `/frames` | W | Create frame |
| PUT | `/frames/:id` | W | Update frame |
| DELETE | `/frames/:id` | W | Delete frame |

**Admin UI:** Frames section (`features/admin/modules/products/FramesAdminPage`) — Phase 1 uses local catalogue state; API ready for backend sync.

## Crystals

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/crystals` | R | List crystals |
| GET | `/crystals/:id` | R | Get by `public_id` |
| POST | `/crystals` | W | Create |
| PUT | `/crystals/:id` | W | Update |
| DELETE | `/crystals/:id` | W | Delete |

**Admin UI:** Crystals section — local catalogue + forms.

## Crystal types

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/types` | R | List types |
| GET | `/types/:id` | R | Get type |
| POST | `/types` | W | Create |
| PUT | `/types/:id` | W | Update |
| DELETE | `/types/:id` | W | Delete |

**Admin UI:** Types section.

## Sunglasses builder catalog

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/sunglasses/catalog` | R | Active tints, options, colours, disclaimer |
| GET | `/sunglasses/catalog/admin` | R | Includes inactive rows |
| GET | `/sunglasses/lens-tints` | R | All lens tints |
| POST | `/sunglasses/lens-tints` | W | Create tint |
| PUT | `/sunglasses/lens-tints/:id` | W | Update tint |
| DELETE | `/sunglasses/lens-tints/:id` | W | Delete tint |
| GET | `/sunglasses/options` | R | All builder options |
| POST | `/sunglasses/options` | W | Create option |
| PUT | `/sunglasses/options/:id` | W | Update option |
| DELETE | `/sunglasses/options/:id` | W | Delete option |
| GET | `/sunglasses/frame-colors` | R | Frame colour swatches |
| POST | `/sunglasses/frame-colors` | W | Create colour |
| PUT | `/sunglasses/frame-colors/:id` | W | Update colour |
| DELETE | `/sunglasses/frame-colors/:id` | W | Delete colour |

**Admin UI:** Sunglasses config (`/admin` → pricing section) — fully API-backed.

### Builder option codes (seeded)

| `code` | UI placement |
|--------|----------------|
| `polarized` | Lens step |
| `prescription` | Options step |

Pricing: `price_surcharge` on options and lens tints; frame base from `frames.base_price`.

## Upload

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/upload/staging` | W | Stage file → private `uploads` bucket |
| POST | `/upload` | W | Cloudinary or Supabase public `assets` |

Multipart field name: **`image`**.

Query on staging: `?batch=<name>` (default `default`). Admin Media page passes batch name (e.g. `admin`).

## Example requests

```bash
# List frames
curl -s http://localhost:5050/api/frames

# Sunglasses catalog (customiser)
curl -s http://localhost:5050/api/sunglasses/catalog

# Admin catalog snapshot
curl -s http://localhost:5050/api/sunglasses/catalog/admin

# Stage image
curl -s -X POST "http://localhost:5050/api/upload/staging?batch=admin" \
  -H "x-api-key: $ADMIN_API_KEY" \
  -F "image=@./sample.png"

# Create frame (with API key)
curl -s -X POST http://localhost:5050/api/frames \
  -H "Content-Type: application/json" \
  -H "x-api-key: $ADMIN_API_KEY" \
  -d '{"name":"Demo","price":99,"description":"","frameImages":[],"lensColors":[]}'
```

## Source of truth

| Layer | Location |
|-------|----------|
| Routes | `backend/src/modules/*/*.routes.ts` |
| OpenAPI | `backend/src/openapi/paths.ts`, `schemas.ts` |
| This doc | Update when routes change |
