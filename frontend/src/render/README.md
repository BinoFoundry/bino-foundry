# Render engine (Phase 1)

Evolves the standalone `customizer.html` prototype into a modular React compositor.

## Flow

```
Catalogue frame/lens  →  catalogue-adapter  →  SunglassesCompositorConfig
                                              ↓
                                    buildCompositorStack()
                                              ↓
                                    LayerStack (SVG + raster layers)
```

## Layout

| Path | Role |
|------|------|
| `types.ts` | Config + layer specs |
| `constants.ts` | Z-order, viewBox |
| `tint/` | Gradient presets + VLT helpers |
| `assets/` | Image preload cache |
| `engine/` | Stack builder + pricing |
| `layers/` | Shadow, lens, highlight, frame, raster |
| `components/` | `CompositorViewport`, `SunglassesCompositor` |
| `adapters/` | Map `useCatalogue` data → config |
| `hooks/` | `useCompositor`, `useSunglassesRenderState` |
| `demo/` | SVG paths from prototype |

## Modes

- **`customiser-dynamic`** — Sunglasses customiser (`features/sunglasses/`): SVG lens gradient + vector frame only; **no** pre-rendered tint images.
- **`catalogue`** — admin / legacy: may use `frameImages` or lens swatch raster when URLs exist.
- **Vector** — prototype SVG stack when no catalogue images.
- **Raster** — `frameImages[0]` or lens swatch image from API.
- **Hybrid** — raster frame + CSS gradient tint overlay.

## Extension (later)

- Canvas/`OffscreenCanvas` export via `RenderFacade.compose`
- Supabase mask assets in `frame_lens_tints`
- Bracelet strand renderer under `render/bracelet/`
