# Milestone 2 — Real-time 2D layered rendering

**Proposal deliverable:** *Real-time 2D layered rendering* (Sunglasses Customiser).

**Status:** Complete (customer compositor scope). Admin clip-editor depth and visual regression suite deferred where noted.

**Guide:** [MILESTONE2_OVERVIEW.md](./MILESTONE2_OVERVIEW.md) · Customer steps: [MILESTONE2_SUNGLASSES_CHECKLIST.md](./MILESTONE2_SUNGLASSES_CHECKLIST.md).

**Baseline (M1):** `svg-clip` + `customiser-dynamic` modes, `SvgClipCompositorView`, admin clip editor, DB `clip_config`.

---

## Proposal acceptance criteria (rendering)

- [x] Tint and option changes update the compositor **without** full page reload
- [x] Layer order correct: frame photo → lens shadow → lens tint (clipped) → highlights
- [x] Front, side, and optional 45° views synchronized for the same configuration
- [x] Works for admin-configured frames with `svg-clip`; clear empty state without clips

---

## Tint & compositing realism

- [x] Gradient tuning — improved stops for classic (solid) vs gradient tints
- [x] Highlight layer from screened plate copy inside clip
- [x] Shadow layer inside clip (`shadowStrength` from clip render settings)
- [x] Side view parity with front (same tint math; shown only when clip ready)
- [x] Optional `three_quarter` view when plate + clip exist
- [x] Polarised state shown in summary UI (compositor tint unchanged — no separate lens SKU art)

---

## SVG clip editor (UX depth)

M1 foundation retained; further polish optional:

- [x] Point insert/delete (Shift+click edge) — M1 `PolygonEditor`
- [x] Pan/zoom, curve handles, undo/redo — M1
- [ ] Connect/open path tools for complex lens shapes — deferred
- [x] Per-view tabs (front / side / 45°) in admin — M1
- [x] Validation before frame save (`clip_status` workflow) — M1 + admin badges
- [x] Bead crop editor parity — M1 `BeadCropEditor`

---

## Performance & assets

- [x] Preload frame plate URLs on frame selection (`AssetLoader`)
- [x] Memoized `SvgClipCompositorView` (tint/plate keyed)
- [x] Isolated tint updates (options do not remount SVG when unchanged)
- [ ] Documented plate size limits — deferred (ops note in admin upload copy)

---

## Bracelet strand rendering (cross-cutting)

Coordinate with [BRACELET](./MILESTONE2_BRACELET_CHECKLIST.md) — not part of sunglasses deliverable.

- [ ] Bead sharpness at all zoom levels
- [ ] Consistent lighting/shadow on placed beads
- [ ] Charm/spacer aspect ratios from crop metadata

---

## Testing

- [x] Unit tests for clip path resolution and tint mapping (`resolve-clip.test.ts`, `compositor-views.test.ts`)
- [ ] Visual regression set for approved frames — deferred (manual QA)

---

## Verify

1. [x] Compare compositor front + side for configured frames; tint switches feel instant.
2. [x] Edit clip in admin → save → customiser reflects same frame plates.
3. [x] Tint switch without full page reload.

---

## References

- `frontend/src/render/lens-clip/`
- `frontend/src/render/components/SvgClipCompositorView.tsx`
- [MILESTONE1_RENDER_CHECKLIST.md](./MILESTONE1_RENDER_CHECKLIST.md)
