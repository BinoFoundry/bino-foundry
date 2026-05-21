## Milestone 1 · Rendering engine + Sunglasses customiser

### Engine foundation

- [x] Prototype concepts from `customizer.html` (layer stack, tint gradient, frame colour, pricing)
- [x] Modular `frontend/src/render/` (tint, assets, engine, layers, components, adapters, hooks)
- [x] `SunglassesCompositor` + `CompositorViewport` (front + side views)
- [x] `renderMode: "customiser-dynamic"` — lens-only SVG gradient; no raster tint swaps in customiser
- [x] Catalogue adapter (`buildCompositorConfigFromCatalogue`) for admin / legacy raster path

### Project brief · Sunglasses customiser

- [x] Two-view display: front + side (`DisplayColumn`)
- [x] Desktop: product display (7 cols) | customisation panel (5 cols)
- [x] Mobile: stacked layout + tab step navigation
- [x] Lens tint applied dynamically to lens only (vector stack)
- [x] Frame colour updates independently of tint
- [x] Flow: Frame → Lens → Options → Final Preview
- [x] Frame SKU selection + colour swatches
- [x] Polarised / non-polarised toggle (+ pricing)
- [x] Tint: Classic / Gradient categories
- [x] Prescription toggle + manual follow-up messaging
- [x] Dynamic pricing (frame base + polarised + prescription)
- [x] Lens appearance disclaimer
- [x] Prescription “degree limitations” tooltip

### Verify

1. `npm run dev` + `npm run dev:backend` — open **Sunglasses**.
2. Walk steps Frame → Lens → Options → Preview; price in header updates with options.
3. Change tint — frame vector colour unchanged; lens gradient updates in both views.
4. Enable prescription — alert on Options + Preview; no checkout auto-confirm (button disabled placeholder).

### Reference

Prototype: `customizer.html` (shadow → lens → highlight → frame).
