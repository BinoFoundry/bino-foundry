# Milestone 2 — Frontend UX & polish

Cross-cutting SPA improvements. **Proposal:** bracelet *responsiveness* — [MILESTONE2_BRACELET_CHECKLIST.md](./MILESTONE2_BRACELET_CHECKLIST.md#responsiveness-improvements); sunglasses layout — [MILESTONE2_SUNGLASSES_CHECKLIST.md](./MILESTONE2_SUNGLASSES_CHECKLIST.md).

## Design system

- [x] Luxury brand tokens audited (gold, muted, spacing, radii) — [DESIGN_TOKENS.md](./frontend/DESIGN_TOKENS.md)
- [x] Consistent button variants across bracelet / sunglasses / admin (`luxe`, `luxe-outline` on builders)
- [x] Loading / empty / error patterns unified (`LoadingState`, `ErrorState`, `EmptyState`)
- [x] Toast / alert copy review (customer-facing, non-technical) — `src/lib/customer-copy.ts`

## Builders shell

- [x] `AppShell` header: price, module nav, mobile menu
- [x] `BuilderViewport` — safe areas, scroll behaviour on mobile
- [x] Module switching preserves no stale state leaks (mounted panes + scroll reset on switch)

## Sunglasses customiser

- [x] Step indicator polish (Frame → Lens → Options → Preview)
- [x] Swatch grids accessible (keyboard, labels, radiogroup)
- [x] Preview step: CTA clarity (prescription vs ready-to-order)
- [x] Performance on tint slider / category change (memoized tint swatches)

## Bracelet builder

- [x] See [MILESTONE2_BRACELET_CHECKLIST.md](./MILESTONE2_BRACELET_CHECKLIST.md) (M2 polish complete)

## Accessibility

- [x] Focus rings on strand slots and controls
- [x] `aria` labels on zoom toolbar and pan mode
- [x] Colour contrast WCAG AA for primary text (muted-foreground tuned)
- [x] Reduced-motion respect for transitions

## Mobile

- [x] Touch targets ≥ 44px on critical actions (bracelet zoom toolbar, library close)
- [x] Library drawer pattern on small screens
- [x] Strand zoom/pan usable with touch (pinch optional)

## Performance

- [x] Code-split admin route (`React.lazy` in `Index.tsx`)
- [x] Lazy-load heavy editor (PolygonEditor) in admin only (`FrameMaskEditor`)
- [x] Bundle size budget documented — [BUNDLE_BUDGET.md](./frontend/BUNDLE_BUDGET.md)

## Testing

- [x] Playwright smoke: three routes (`frontend/e2e/smoke.spec.ts`, `npm run test:e2e`)
- [x] Vitest coverage for bracelet pricing + capacity hooks

## Verify

- [ ] Lighthouse accessibility ≥ 90 on `/bracelet` and `/sunglasses` (best effort — run locally)
- [x] No React maximum-update-depth regressions (build + unit tests pass)
