# Milestone 2 — Crystal Bracelet Builder (proposal deliverables)

**Guide:** [MILESTONE2_OVERVIEW.md](./MILESTONE2_OVERVIEW.md). Per **approved proposal**. Cross-cutting UI: [MILESTONE2_FRONTEND_CHECKLIST.md](./MILESTONE2_FRONTEND_CHECKLIST.md).

**Baseline (M1):** Circular strand, library, twinning, DB bead sizes, pricing, save config, strand guide, zoom/pan.

---

## Categorization improvements

Help users find beads by type/category (crystals, charms, spacers, etc.).

- [x] Bead library grouped or filterable by **bead type** / category (from `bead_types` or equivalent)
- [x] Search or tabs for crystal vs charm vs spacer (as catalogue supports)
- [x] Type labels visible on beads in library (not only on strand hover)
- [x] Admin-defined types reflected in builder without code changes
- [x] Empty category states (“No charms yet”) instead of blank panels
- [x] Consistent naming with admin catalogue (no slug leakage in UI)

**Verify:** Add new bead type in admin → library shows new filter/group when beads exist.

---

## Dynamic sizing logic

Wrist and product rules drive layout reliably.

- [x] Wrist size (cm) changes **immediately** rebuild slot layout / capacity
- [x] Bead size (mm) from admin options drives capacity formula (not hardcoded 6/8/10 only)
- [x] Twin mode: independent wrist A/B sizing when enabled
- [x] UI explains current wrist + bead size + resulting slot count
- [x] `capacity.ts` documented and covered by unit tests
- [x] Layout remount stable (no ghost slots or duplicate indices)

**Verify:** Change wrist 16 → 18 cm; slot count and ring update without manual refresh.

---

## Bead quantity adjustment based on size

Proposal example: fewer beads when mm increases for same wrist.

- [x] Slot count **decreases** when bead mm increases (same wrist) per product formula
- [x] Slot count **increases** when bead mm decreases (within bounds)
- [x] Changing bead size remaps or prunes beads with user-visible feedback if slots shrink
- [x] Summary shows `placed / total` after every size change
- [x] Pricing recalculates with size multipliers from DB (`bead_sizes`, `config_kv`)

**Verify:** Same wrist: 6mm shows more slots than 10mm; placed beads handled when count drops.

---

## Responsiveness improvements

- [x] Usable on phone: library, strand, summary, toolbar controls
- [x] Touch-friendly bead place, remove, reorder (not hover-only)
- [x] Twin bracelets: layout when two strands (wrap or scroll strategy)
- [x] Zoom/pan controls reachable on small screens
- [x] No horizontal overflow on common breakpoints (375px–1440px)
- [x] Safe areas respected (`100dvh`, notched devices)

**Verify:** Test on mobile viewport: complete bracelet start-to-finish.

---

## Asset scaling improvements

Beads and cord render crisp at all zoom levels.

- [x] Bead images scale from crop metadata (`bead-crop`) without circle clipping artifacts
- [x] Strand zoom uses **layout pixel size** (no CSS blur on upscale)
- [x] Charms/spacers keep correct aspect ratio on strand
- [x] Cord / guide ring scales proportionally with `strandSize`
- [x] High-DPI screens: acceptable sharpness for placed beads
- [x] Processed asset URLs preferred over raw upload when available

**Verify:** Zoom to max; pan strand; beads remain sharp; no oval distortion on charms.

---

## Additional M2 enhancements (not separate proposal bullets)

Optional but tracked elsewhere: twin duplicate, save/load designs, premium summary panel — see prior sections in git history or [Commerce](./MILESTONE2_COMMERCE_CHECKLIST.md).

- [x] Save design + pricing summary ([Bracelet API](../backend/src/modules/bracelet/))
- [x] Remove bead + match-first-bracelet UX polish

---

## References

- `frontend/src/features/bracelet/`
- `frontend/src/components/BraceletBuilder.tsx`
- `frontend/src/components/BeadLibrary.tsx`
- `frontend/src/components/SortableCircularStrand.tsx`
- `backend/src/modules/bracelet/`, `bead-sizes/`, `bead-libraries/`
