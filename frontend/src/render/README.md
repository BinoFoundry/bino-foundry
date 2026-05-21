# Render engine (Phase 1)

Modular compositor for sunglasses (vector + **masked photo** plates from `bino-rendering`).

## Flow

```
Frame renderViews (front/side plates + MaskConfig)
        ↓
buildCustomiserCompositorConfig()  →  renderMode: masked-photo
        ↓
CanvasCompositorView  →  renderMaskedViewToCanvas (lens tint only in mask)
```

Legacy / fallback:

```
No masks ready  →  customiser-dynamic (SVG lens gradient + vector frame)
```

## Layout

| Path | Role |
|------|------|
| `types.ts` | Config + layer specs |
| `mask/` | Polygon editor, auto-mask, Bézier rasterization (`bino-rendering` port) |
| `engine/canvas/` | `lens-compositor`, `canvas-render-pipeline` |
| `constants.ts` | Z-order, viewBox |
| `tint/` | Gradient presets |
| `engine/` | Stack builder + pricing |
| `layers/` | SVG + raster React layers |
| `components/` | `SunglassesCompositor`, `CanvasCompositorView` |
| `adapters/` | Customiser + catalogue config |
| `hooks/` | `useFrameRenderBundle`, `useSunglassesRenderState` |

## Modes

| Mode | When | Behaviour |
|------|------|-----------|
| **`masked-photo`** | Frame has front/side plates + valid polygon masks | Canvas tint inside lens polygons (`maskOnly`) |
| **`customiser-dynamic`** | No masks | SVG lens gradient; customers change tint only |
| **`catalogue`** | Legacy raster URLs | Optional `frameImages` stack |

## Admin workflow

Frames are edited in **Admin → Frames** (not a separate menu):

1. Upload **front** and **side** photos.
2. **Edit mask** inline per view (Draw / Select / Pan, left + right lens polygons).
3. Save frame — masks stored in catalogue + API (`frame_render_views` when migrated).

## Database

Apply `database/migrations/000004_frame_render_views.sql`. API: `GET/PUT /api/rendering/frames/:id/...`.

## Extension (later)

- Promote plates from staging → `frames/{slug}/views/` storage keys
- Canvas export via `RenderFacade.compose`
- Bracelet strand renderer under `render/bracelet/`
