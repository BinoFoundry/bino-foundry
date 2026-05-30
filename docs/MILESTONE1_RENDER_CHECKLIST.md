# Milestone 1 — Rendering engine + Sunglasses customiser (completed)

2D layered rendering foundation with SVG clip-path compositing for photo frames.

## Engine foundation

- [x] Prototype concepts from `customizer.html` (layer stack, tint gradient, frame colour, pricing)
- [x] Modular `frontend/src/render/` — tint, lens-clip, mask/PolygonEditor, components, adapters
- [x] `SunglassesCompositor` + `CompositorViewport` (front + side views)
- [x] **`renderMode: "svg-clip"`** — tint inside SVG `clipPath` from DB (`clip_config`)
- [x] **`renderMode: "customiser-dynamic"`** — fallback SVG lens gradient when clips not ready
- [x] Catalogue / legacy raster adapter (`buildCompositorConfigFromCatalogue`)
- [x] Frame render views API integration (`buildCustomiserCompositorConfig`)

## SVG clip pipeline (foundation extension)

- [x] Migration `000008` — `clip_config`, `clip_status` on `frame_render_views`
- [x] `SvgClipCompositorView` — dynamic gradient tint + highlights per lens region
- [x] Admin `FrameMaskEditor` + `PolygonEditorShell` — draw/edit paths per view axis
- [x] Persist clips via `PUT /api/rendering/frames/:id/views/:axis`
- [x] Load existing paths for re-edit; undo/redo in editor
- [x] Bead crop uses same editor pattern (`BeadCropEditor`, single-path mode)

## Sunglasses customiser (project brief)

- [x] Two-view display: front + side
- [x] Desktop: product display | customisation panel
- [x] Mobile: stacked / tab steps
- [x] Lens tint on lens only (vector / clip regions)
- [x] Frame colour independent of tint
- [x] Flow: Frame → Lens → Options → Preview
- [x] Frame selection + colour swatches
- [x] Polarised / non-polarised (+ pricing)
- [x] Tint: Classic / Gradient categories
- [x] Prescription toggle + manual follow-up messaging
- [x] Dynamic pricing
- [x] Lens disclaimer + prescription tooltip

## Intentionally not M1-complete

- Photorealistic tint matching physical lenses (M2)
- `three_quarter` view fully wired in customiser UI if not enabled (M2)
- Canvas mask bitmap pipeline deprecated for new saves

## Verify

1. `npm run dev` + `npm run dev:backend` — open **Sunglasses**.
2. Frame with saved clips — tint changes; frame photo unchanged.
3. Frame without clips — falls back to `customiser-dynamic`.
4. Admin — upload plates, edit clip, save, re-open edit (path + anchors visible).
5. Walk Frame → Lens → Options → Preview; prescription disables checkout placeholder.

## Reference

- Prototype: `customizer.html`
- Architecture: [frontend/src/render/README.md](../frontend/src/render/README.md)

## Milestone 2

Tint realism, gradient quality, performance, additional views — [MILESTONE2_RENDER_CHECKLIST.md](./MILESTONE2_RENDER_CHECKLIST.md).
