# Features (Phase 1 scaffold)

```
features/
  bracelet/     # (planned) strand builder components — today under src/components/
  sunglasses/   # Frame → Lens → Options → Preview customiser
  admin/        # AdminApp, layout, product/pricing/media modules
```

## Unified bead library (000007)

Bracelet catalogue uses one system:

| Layer | Location |
|-------|----------|
| DB | `bead_types`, `bead_libraries` |
| API | `/api/bead-types`, `/api/bead-libraries`, `PUT …/crop` |
| State | `@/state/catalogue` — `beadTypes`, `beadLibraries` |
| Admin | **Bead library**, **Bead types** |
| Crop | `@/render/bead-crop`, `@/render/editor/PolygonEditorShell`, `BeadCropEditor` |

Legacy `/crystals`, `/charms`, `/spacers` routes removed after migration.

Until migration, builders consume:

- `@/state/catalogue` — catalogue data + mutations
- `@/services/api` — frames, upload; beads via `beadsApi`
- `@/render` — sunglasses compositor + bead crop helpers
