# Milestone 1 — Admin dashboard foundation (completed)

Modular admin for catalogue, sunglasses config, clip editing, media staging, and bracelet bead sizes.

## Structure

| Path | Purpose |
|------|---------|
| `frontend/src/features/admin/AdminApp.tsx` | Shell + section routing |
| `features/admin/modules/dashboard/` | Counts + navigation |
| `features/admin/modules/products/` | Frames, crystals, types |
| `features/admin/modules/pricing/` | Sunglasses builder catalog |
| `features/admin/modules/media/` | Staging uploads |
| `features/admin/components/FrameMaskEditor.tsx` | SVG lens clip editor |
| `features/admin/components/BeadCropEditor.tsx` | Bead crop clip editor |
| Bead sizes admin page | `bead-sizes` API CRUD |

## Sections

- [x] Dashboard
- [x] Frames — list, detail, create/edit, render views, **clip editor**
- [x] Crystals / types — CRUD (forms + lists)
- [x] Sunglasses config — lens tints, options (API-backed)
- [x] Media — batch staging via `POST /upload/staging`
- [x] **Bead sizes** — manage mm options, multipliers, default flag
- [x] Bead libraries / types (via catalogue modules as implemented)

## Rendering admin workflow

1. Upload front + side (and optional) frame plates.
2. **Edit clip** — polygon editor → SVG `pathD` in `clip_config`.
3. Save frame / view via rendering API.
4. Customiser uses `svg-clip` mode when `clip_status` ready.

## Bead workflow

1. Manage bead library entries (unified `bead_libraries`).
2. **Edit crop** — single-path clip for strand display asset.
3. Save processed asset metadata when pipeline complete.

## Integration

- Route: `/admin` → `AdminApp`
- Mutations: `VITE_ADMIN_API_KEY` when backend `ADMIN_API_KEY` set
- Sunglasses catalog: `@/state/sunglasses-catalog`
- Catalogue: `@/state/catalogue` (hybrid local + API — see limitations)

## Known M1 limitations (→ M2)

- [ ] Frames/crystals/types fully API-synced (no local-only drift)
- [ ] Route-level auth gate for `/admin`
- [ ] Promote staging → catalogue buckets from admin UI + `assets` rows
- [ ] Shared `config_kv` editor (bracelet + global pricing)
- [ ] Clip editor UX: point connect/delete ergonomics (foundation undo/redo exists)

## Documentation

- [architecture/ADMIN.md](./architecture/ADMIN.md)
- [features/admin/README.md](../frontend/src/features/admin/README.md)

## Verify

1. Open `/admin` with API + key configured.
2. Edit frame clip — save — reload — path restores.
3. Create/edit bead size — appears in bracelet builder.
4. Upload to media staging — object in Supabase `uploads` bucket.

## Milestone 2

[ MILESTONE2_ADMIN_CHECKLIST.md](./MILESTONE2_ADMIN_CHECKLIST.md)
