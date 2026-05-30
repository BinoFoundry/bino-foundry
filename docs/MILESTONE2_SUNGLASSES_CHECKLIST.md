# Milestone 2 — Sunglasses Customiser (proposal deliverables)

**Guide:** [MILESTONE2_OVERVIEW.md](./MILESTONE2_OVERVIEW.md). **Status:** Complete (customer customiser scope). Technical rendering: [MILESTONE2_RENDER_CHECKLIST.md](./MILESTONE2_RENDER_CHECKLIST.md).

**Baseline (M1):** Step flow Frame → Lens → Options → Preview; two views; dynamic tint; polarised/prescription pricing; SVG clip foundation.

---

## Frame selection system

- [x] Frame catalogue loads from API/DB (stable list, active/inactive)
- [x] Clear frame browser: name, price, thumbnail / compositor preview
- [x] **Colour variants** — **N/A:** per-frame swatches removed (`000005`); frame colour unchanged; **global lens tints** drive colour
- [x] Selected frame persists across steps and refresh (`sessionStorage`)
- [x] Frame change keeps global tint/options (tints are catalogue-wide, not per-frame)
- [x] Desktop: frame visible in product column; mobile: usable frame picker in flow
- [x] Admin-published frames appear in customiser without redeploy

**Verify:** [x] Select multiple frames; compositor updates front + side (+ 45° when configured); price base updates.

---

## Lens selection (polarised / non-polarised)

- [x] Polarised vs non-polarised clearly labeled (“Standard lenses” / “Polarised lenses”)
- [x] Selection updates **price in real time** (header/summary)
- [x] Selection stored in configuration state for preview / future order
- [x] Default: standard (non-polarised); polarised via add-on toggle
- [x] Mobile-friendly control (switch on Lens step)

**Verify:** [x] Toggle polarised; price delta matches admin/API rules.

---

## Tint selection using color codes

- [x] Classic + Gradient categories
- [x] Each tint shows customer-facing label + **color code** (`tint.code`)
- [x] Selecting tint applies hex / gradient stops to compositor
- [x] Tint applies to **lens only**; frame unchanged
- [x] No dependency on swapping full lens PNGs
- [x] Empty category lists show friendly message

**Verify:** [x] Edit tint hex in admin → customiser reflects new color on all configured views.

---

## Real-time 2D layered rendering

*Detailed tasks:* [MILESTONE2_RENDER_CHECKLIST.md](./MILESTONE2_RENDER_CHECKLIST.md)

- [x] Layered stack renders in **real time** on tint/option changes
- [x] Front + side (+ optional 45°) stay in sync
- [x] `svg-clip` when clips configured; message when unavailable (no misleading vector fallback in customiser)
- [x] Improved compositing (shadow layer, gradient tuning, memoized SVG updates)

---

## Final preview structure

- [x] Dedicated **Preview** step with full configuration recap
- [x] Shows frame, lens type, tint (name + **code** + hex), options
- [x] **Total price** prominent and matches prior steps
- [x] Lens appearance disclaimer visible
- [x] Prescription: manual follow-up messaging when enabled
- [x] Primary CTA: **Request quote** / **Request consultation** (copies config; commerce integration deferred)
- [x] Layout polished on desktop and mobile

**Verify:** [x] Walk Frame → Lens → Options → Preview; recap matches selections.

---

## References

- `frontend/src/features/sunglasses/`
- `frontend/src/render/components/SvgClipCompositorView.tsx`
- `backend/src/modules/sunglasses/`
