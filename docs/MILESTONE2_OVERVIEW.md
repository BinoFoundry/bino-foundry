# Milestone 2 — Guide (core builder development)

**Status:** Not started.

**Single guide for Milestone 2.** Use this file for scope, contract deliverables, work order, and sign-off. Detailed task checklists are linked per deliverable.

Milestone 1 delivered architecture and working foundations ([MILESTONE1_SIGNOFF.md](./MILESTONE1_SIGNOFF.md)). Milestone 2 delivers the **approved proposal**: production-ready sunglasses customiser, crystal bracelet builder, and admin dashboard.

---

## Prerequisites (M1)

- [ ] [MILESTONE1_SIGNOFF.md](./MILESTONE1_SIGNOFF.md) verification passed
- [ ] Migrations `000001`–`000010` applied on target Supabase
- [ ] No blocking regressions: SVG clip load/edit, sunglasses stability, bracelet save API

## Principles

- Supabase = database + storage only; business logic in Express
- Separate frontend / backend; deployment-flexible (Vercel + VPS)
- No 3D/WebGL unless contract amended
- Reference UI for inspiration only — no copied code or assets

## Suggested work order

1. **Admin** — glasses, tints, crystals/accessories, pricing (unblocks correct builder data)
2. **Sunglasses** — frame, lens, tint, preview + [render quality](./MILESTONE2_RENDER_CHECKLIST.md)
3. **Bracelet** — categorization, sizing, quantity, responsive, asset scaling
4. **[Backend](./MILESTONE2_BACKEND_CHECKLIST.md)** — auth / RLS before public launch (supporting, not a proposal bullet)

Optional later: [Commerce](./MILESTONE2_COMMERCE_CHECKLIST.md) (not in proposal list).

---

## Contract deliverables

Tick each row when its checklist section is verified. **Checklist** = detailed tasks; **Code** = where to implement.

### Sunglasses Customiser

| Deliverable | Checklist | Code (starting point) |
|-------------|-----------|------------------------|
| Frame selection system | [Sunglasses § Frame](./MILESTONE2_SUNGLASSES_CHECKLIST.md#frame-selection-system) | `features/sunglasses/` Frame step, frame SKUs, colour swatches |
| Lens selection (polarised / non-polarised) | [Sunglasses § Lens](./MILESTONE2_SUNGLASSES_CHECKLIST.md#lens-selection-polarised--non-polarised) | Options step, `sunglasses_builder_options`, pricing |
| Tint selection using color codes | [Sunglasses § Tint](./MILESTONE2_SUNGLASSES_CHECKLIST.md#tint-selection-using-color-codes) | Lens step, `sunglasses_lens_tints`, hex / gradient metadata |
| Real-time 2D layered rendering | [Render checklist](./MILESTONE2_RENDER_CHECKLIST.md) | `SvgClipCompositorView`, `SunglassesCompositor`, `render/` |
| Final preview structure | [Sunglasses § Preview](./MILESTONE2_SUNGLASSES_CHECKLIST.md#final-preview-structure) | Preview step, summary, prescription messaging, CTA |

**Sunglasses verify:** Frame → Lens → Options → Preview on desktop and mobile; tint changes update compositor in real time; price matches admin rules.

### Crystal Bracelet Builder

| Deliverable | Checklist | Code (starting point) |
|-------------|-----------|------------------------|
| Categorization improvements | [Bracelet § Categories](./MILESTONE2_BRACELET_CHECKLIST.md#categorization-improvements) | `BeadLibrary`, `bead_types`, charms/spacers |
| Dynamic sizing logic | [Bracelet § Sizing](./MILESTONE2_BRACELET_CHECKLIST.md#dynamic-sizing-logic) | `capacity.ts`, wrist inputs, `useBraceletBuilder` |
| Bead quantity adjustment based on size | [Bracelet § Quantity](./MILESTONE2_BRACELET_CHECKLIST.md#bead-quantity-adjustment-based-on-size) | `strandCapacity`, layout remount, prune on shrink |
| Responsiveness improvements | [Bracelet § Responsive](./MILESTONE2_BRACELET_CHECKLIST.md#responsiveness-improvements) · [Frontend](./MILESTONE2_FRONTEND_CHECKLIST.md) | `BraceletBuilder`, `BuilderViewport`, mobile library |
| Asset scaling improvements | [Bracelet § Scaling](./MILESTONE2_BRACELET_CHECKLIST.md#asset-scaling-improvements) | `bead-crop/`, `SortableCircularStrand`, `useStrandZoom` |

**Bracelet verify:** Same wrist: higher mm → fewer slots; library categories work; mobile build completes; zoom keeps beads sharp.

### Admin Dashboard

| Deliverable | Checklist | Code (starting point) |
|-------------|-----------|------------------------|
| Manage glasses and variants | [Admin § Glasses](./MILESTONE2_ADMIN_CHECKLIST.md#manage-glasses-and-variants) | Frames admin, render views, clips, frame media |
| Manage lens options & tint data | [Admin § Tints](./MILESTONE2_ADMIN_CHECKLIST.md#manage-lens-options--tint-data) | Sunglasses catalog admin, lens tints CRUD |
| Manage crystal/accessory data | [Admin § Crystals](./MILESTONE2_ADMIN_CHECKLIST.md#manage-crystalaccessory-data) | Bead libraries, types, charms, spacers, bead sizes |
| Pricing configuration support | [Admin § Pricing](./MILESTONE2_ADMIN_CHECKLIST.md#pricing-configuration-support) | `config_kv`, sunglasses options, bracelet pricing rules |

**Admin verify:** New frame → clip → visible in customiser; tint hex change → customiser color updates; pricing change → both builders update totals.

---

## Detailed checklists (implementation)

| Doc | Use for |
|-----|---------|
| [SUNGLASSES](./MILESTONE2_SUNGLASSES_CHECKLIST.md) | Per-deliverable tasks for sunglasses (proposal sections above) |
| [RENDER](./MILESTONE2_RENDER_CHECKLIST.md) | 2D compositing quality, clips, performance |
| [BRACELET](./MILESTONE2_BRACELET_CHECKLIST.md) | Per-deliverable tasks for bracelet |
| [ADMIN](./MILESTONE2_ADMIN_CHECKLIST.md) | Per-deliverable tasks for admin |
| [FRONTEND](./MILESTONE2_FRONTEND_CHECKLIST.md) | Shared shell, a11y, design tokens |
| [BACKEND](./MILESTONE2_BACKEND_CHECKLIST.md) | Auth, RLS, API hardening (supporting) |
| [COMMERCE](./MILESTONE2_COMMERCE_CHECKLIST.md) | Optional · not in proposal |

---

## Milestone 2 complete when

- [ ] Every **contract deliverable** row in the tables above is verified
- [ ] Sunglasses: full step flow with real-time rendering on front + side
- [ ] Bracelet: correct slot counts for wrist + bead size; usable on mobile
- [ ] Admin: staff can manage catalogue and pricing without SQL
- [ ] M1 prerequisites still valid on target environment

## Out of scope (unless contract amended)

- Native mobile apps, 3D/AR try-on
- Full payment gateway integration
- Multi-language / multi-currency beyond USD foundation
- Inventory / warehouse management

## Related

- [Milestone 1 sign-off](./MILESTONE1_SIGNOFF.md)
- [Architecture overview](./architecture/OVERVIEW.md)
- [Documentation hub](./README.md)
