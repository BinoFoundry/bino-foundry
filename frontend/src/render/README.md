# Render engine (Milestone 1 foundation · M2 quality pass)

Modular compositor for sunglasses (vector demo + **SVG clipPath** photo plates). Visual realism improvements are tracked in [docs/MILESTONE2_RENDER_CHECKLIST.md](../../../docs/MILESTONE2_RENDER_CHECKLIST.md).

## Flow

```
Frame renderViews (front/side plates + LensClipConfig SVG paths)
        ↓
buildCustomiserCompositorConfig()  →  renderMode: svg-clip
        ↓
SvgClipCompositorView  →  tint + highlights inside SVG clipPath regions
```

Legacy / fallback:

```
No clips ready  →  customiser-dynamic (SVG lens gradient + vector frame)
```

## Layout

| Path | Role |
|------|------|
| `types.ts` | Config + layer specs |
| `lens-clip/` | SVG path builder, clip resolve, render settings |
| `mask/` | Polygon editor (admin clip drawing only; no canvas tint pipeline) |
| `engine/canvas/` | Legacy canvas pipeline (deprecated for customiser) |
| `components/` | `SunglassesCompositor`, `SvgClipCompositorView` |
| `adapters/` | Customiser + catalogue config |

## Modes

| Mode | When | Behaviour |
|------|------|-----------|
| **`svg-clip`** | Frame has plates + valid `clipConfig` | SVG gradient tint + screened highlights per lens clip |
| **`customiser-dynamic`** | No clips | SVG lens gradient on demo vectors |
| **`catalogue`** | Legacy raster URLs | Optional `frameImages` stack |

## Admin workflow

1. Upload **front** and **side** (45°) photos.
2. **Edit clip** — polygon/curve editor → saved as SVG `pathD` in `clip_config`.
3. Save frame — persisted to `frame_render_views`.

## Database

Apply `000004_frame_render_views.sql` and **`000008_svg_lens_clip_config.sql`**. API: `GET/PUT /api/rendering/frames/:id/views/:axis`.
