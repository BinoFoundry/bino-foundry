# Milestone 2 — Admin Dashboard (proposal deliverables)

**Guide:** [MILESTONE2_OVERVIEW.md](./MILESTONE2_OVERVIEW.md). Per **approved proposal**. Security and API hardening: [MILESTONE2_BACKEND_CHECKLIST.md](./MILESTONE2_BACKEND_CHECKLIST.md).

**Status:** Complete (admin proposal scope).

**Baseline (M1):** `AdminApp`, frames/crystals/types UI, sunglasses config API, media staging, clip/crop editors, bead sizes.

---

## Manage glasses and variants

Full CRUD for frames and sellable variants (colours, views, assets).

- [x] List/create/edit/delete **frames** via API (no local-only catalogue drift)
- [x] Upload and attach **frame media** (front, side, optional angles)
- [x] Manage **frame colour variants** / builder-facing swatches — **N/A:** superseded by global `sunglasses_lens_tints` (table dropped `000005`)
- [x] **SVG lens clip** editor per view; save to `frame_render_views`
- [x] Clip status visible (draft / ready / missing)
- [x] Promote staged uploads → catalogue storage + `assets` linkage — staging URL copy or direct upload on frame/bead forms → catalogue bucket URLs
- [x] Published frame appears in Sunglasses customiser frame selection (`isActive` + admin “Published” toggle)

**Verify:** [x] New frame end-to-end: create → upload → clip → active → visible in customiser.

---

## Manage lens options & tint data

- [x] CRUD **lens tints** (name, category, **color code / hex**, gradient metadata)
- [x] CRUD **builder options** (polarised, prescription, pricing flags)
- [x] Tint preview swatch in admin matches customiser application
- [x] Classic vs Gradient (or equivalent) grouping manageable
- [x] Changes persist to `sunglasses_lens_tints` / related tables via API
- [x] Invalid color codes blocked with validation message

**Verify:** [x] Edit tint hex in admin → sunglasses Lens step shows new color on compositor.

---

## Manage crystal/accessory data

Unified bead catalogue for bracelet builder.

- [x] **Bead libraries** CRUD (crystals and unified bead entries)
- [x] **Bead types** CRUD (categorization for library filters)
- [x] **Charms** and **spacers** management — via unified `bead_libraries` + bead types
- [x] **Bead sizes** admin (mm, label, multiplier, default, active)
- [x] **Bead crop** editor: clip + processed asset path
- [x] Image upload / promotion for bead assets (`bracelets/beads/…` paths)
- [x] Inactive records hidden in builder; active appear without redeploy

**Verify:** [x] New crystal + charm in admin → categorized in builder library → places on strand.

---

## Pricing configuration support

- [x] Edit **bracelet pricing** rules — **Bracelet pricing** admin section (form UI: currency, size multipliers, priced bead types)
- [x] Edit **sunglasses** option pricing — **Sunglasses config** admin section (lens tints + add-on options)
- [x] Frame **base price** on frame records
- [x] Bead **price multipliers** per `bead_sizes` row
- [x] JSON validation before save; human-readable errors
- [x] Optional: audit/description field per config key — not exposed in UI (auto-managed server-side)
- [x] Builder totals match admin-configured rules after save (sunglasses + bracelet pricing engines read API/catalogue)

**Verify:** [x] Change polarised surcharge and 10mm multiplier → both builders show updated totals.

---

## Supporting admin work (engineering)

- [x] `/admin` route protection — catalogue **writes** gated by `ADMIN_API_KEY` / `VITE_ADMIN_API_KEY`; admin UI shows key warning (full SPA auth deferred to [Backend checklist](./MILESTONE2_BACKEND_CHECKLIST.md))
- [x] Search on large lists (`useAdminList`)
- [x] Pagination on large lists (`useAdminList` + `AdminListPagination`, 25 per page)
- [x] Responsive admin layout
- [x] `config_kv` bracelet pricing editor — **Bracelet pricing** sidebar (separate from Sunglasses config)

---

## References

- [architecture/ADMIN.md](./architecture/ADMIN.md)
- [assets/WORKFLOW.md](./assets/WORKFLOW.md)
- `frontend/src/features/admin/`
- `backend/src/modules/frames/`, `sunglasses/`, `bead-libraries/`, `bead-sizes/`
