# Milestone 2 — Sunglasses Customiser (proposal deliverables)

**Guide:** [MILESTONE2_OVERVIEW.md](./MILESTONE2_OVERVIEW.md). Customer-facing sunglasses configurator per **approved proposal**. Technical rendering depth lives in [MILESTONE2_RENDER_CHECKLIST.md](./MILESTONE2_RENDER_CHECKLIST.md).

**Baseline (M1):** Step flow Frame → Lens → Options → Preview; two views; dynamic tint; polarised/prescription pricing; SVG clip foundation.

---

## Frame selection system

Complete, production-ready frame picking (SKU, imagery, variants).

- [ ] Frame catalogue loads from API/DB (stable list, active/inactive)
- [ ] Clear frame browser: name, price, thumbnail / compositor preview
- [ ] **Colour variants** where applicable (swatches tied to frame data, not hardcoded)
- [ ] Selected frame persists across steps and refresh where scoped
- [ ] Frame change resets dependent lens/tint only when business rules require
- [ ] Desktop: frame visible in product column; mobile: usable frame picker in flow
- [ ] Admin-published frames appear in customiser without redeploy

**Verify:** Select multiple frames and colours; compositor updates front + side; price base updates.

---

## Lens selection (polarised / non-polarised)

- [ ] Polarised vs non-polarised toggle clearly labeled (customer language)
- [ ] Selection updates **price in real time** (header/summary)
- [ ] Selection stored in configuration state for preview / future order
- [ ] Default and valid combinations documented (per frame if needed)
- [ ] Mobile-friendly control (not desktop-only toggle)

**Verify:** Toggle polarised; price delta matches admin/API rules.

---

## Tint selection using color codes

Tint driven by **data** (color codes / hex), not pre-rendered lens images.

- [ ] Classic + Gradient categories (or proposal-equivalent grouping)
- [ ] Each tint shows customer-facing label + **color code** (admin-managed)
- [ ] Selecting tint applies correct hex / gradient stops to compositor
- [ ] Tint applies to **lens only**; frame colour unchanged
- [ ] No dependency on swapping full lens PNGs in customiser path
- [ ] Invalid or missing color metadata handled gracefully in admin + UI

**Verify:** Change tint in admin color code → customiser reflects new color immediately on both views.

---

## Real-time 2D layered rendering

*Detailed tasks:* [MILESTONE2_RENDER_CHECKLIST.md](./MILESTONE2_RENDER_CHECKLIST.md)

Proposal requirement summary:

- [ ] Layered stack renders in **real time** on tint/option changes (no full page reload)
- [ ] Front + side views stay in sync
- [ ] `svg-clip` path when clips configured; sensible fallback otherwise
- [ ] Acceptable visual quality vs approved reference frames (M2 bar)

---

## Final preview structure

- [ ] Dedicated **Preview** step with full configuration recap
- [ ] Shows frame, lens type, tint (name + color reference), options (polarised, prescription)
- [ ] **Total price** prominent and matches prior steps
- [ ] Lens appearance disclaimer visible
- [ ] Prescription: manual follow-up messaging when enabled (no false “buy now”)
- [ ] Primary CTA structure defined (order request / continue — per commerce scope)
- [ ] Layout polished on desktop and mobile (stacked summary)

**Verify:** Walk Frame → Lens → Options → Preview; recap matches selections; prescription path shows correct alerts.

---

## References

- `frontend/src/features/sunglasses/`
- `frontend/src/components/SunglassesCompositor.tsx` (if used by feature module)
- `backend/src/modules/sunglasses/`
- [MILESTONE1_RENDER_CHECKLIST.md](./MILESTONE1_RENDER_CHECKLIST.md)
