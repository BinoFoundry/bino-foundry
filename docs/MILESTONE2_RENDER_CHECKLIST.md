# Milestone 2 — Real-time 2D layered rendering

**Proposal deliverable:** *Real-time 2D layered rendering* (Sunglasses Customiser).

Proposal scope and sign-off: [MILESTONE2_OVERVIEW.md](./MILESTONE2_OVERVIEW.md). Customer steps: [MILESTONE2_SUNGLASSES_CHECKLIST.md](./MILESTONE2_SUNGLASSES_CHECKLIST.md).

Improve compositing quality and performance on top of the M1 SVG clip foundation.

**Baseline (M1):** `svg-clip` + `customiser-dynamic` modes, `SvgClipCompositorView`, admin clip editor, DB `clip_config`.

## Proposal acceptance criteria (rendering)

- [ ] Tint and option changes update the compositor **without** full page reload
- [ ] Layer order correct: frame photo → lens tint (clipped) → highlights → UI-consistent frame colour
- [ ] Front and side views stay synchronized for the same configuration
- [ ] Works for admin-configured frames with `svg-clip`; acceptable fallback without clips

## Tint & compositing realism

- [ ] Gradient tint tuning (classic + gradient categories) — opacity, stops, axis
- [ ] Highlight / shadow layers balanced against frame photography
- [ ] Reduce “flat overlay” appearance inside clip regions
- [ ] Side view parity with front (colour + gradient consistency)
- [ ] Optional `three_quarter` view in customiser when plate + clip exist
- [ ] Prescription / polarised states reflected in preview where applicable

## SVG clip editor (UX depth)

- [ ] Point insert/delete without redrawing entire path
- [ ] Clear on-canvas handles (visibility on all backgrounds)
- [ ] Connect/open path tools for complex lens shapes
- [ ] Stable session when switching front / side / 45° tabs
- [ ] Validation feedback before save (`clip_status` workflow)
- [ ] Bead crop editor: same ergonomics as frame editor

## Performance & assets

- [ ] Lazy-load large frame plates; size limits documented
- [ ] Avoid layout thrash on tint change (memoization / isolated updates)
- [ ] Retina / DPR-aware compositor sizing
- [ ] Preload strategy for active frame views

## Bracelet strand rendering (cross-cutting)

- [ ] Bead image sharpness at all zoom levels (coordinate with [BRACELET](./MILESTONE2_BRACELET_CHECKLIST.md))
- [ ] Consistent lighting/shadow on placed beads vs cord
- [ ] Charm/spacer aspect ratios from crop metadata

## Testing

- [ ] Visual regression set for 2–3 approved frames + tint combinations
- [ ] Unit tests for clip path resolution and tint math helpers

## Verify

1. Compare approved reference photos vs compositor screenshot (front + side).
2. Edit clip → save → reload → pixel-alignment acceptable.
3. Tint switch &lt; 100ms perceived on mid-range laptop.

## References

- `frontend/src/render/lens-clip/`
- `frontend/src/render/components/SvgClipCompositorView.tsx`
- [MILESTONE1_RENDER_CHECKLIST.md](./MILESTONE1_RENDER_CHECKLIST.md)
