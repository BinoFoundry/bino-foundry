# Milestone 2 — Frontend UX & polish

Cross-cutting SPA improvements. **Proposal:** bracelet *responsiveness* — [MILESTONE2_BRACELET_CHECKLIST.md](./MILESTONE2_BRACELET_CHECKLIST.md#responsiveness-improvements); sunglasses layout — [MILESTONE2_SUNGLASSES_CHECKLIST.md](./MILESTONE2_SUNGLASSES_CHECKLIST.md).

## Design system

- [ ] Luxury brand tokens audited (gold, muted, spacing, radii)
- [ ] Consistent button variants across bracelet / sunglasses / admin
- [ ] Loading / empty / error patterns unified (`LoadingState`, `ErrorState`)
- [ ] Toast / alert copy review (customer-facing, non-technical)

## Builders shell

- [ ] `AppShell` header: price, module nav, mobile menu
- [ ] `BuilderViewport` — safe areas, scroll behaviour on mobile
- [ ] Module switching preserves no stale state leaks

## Sunglasses customiser

- [ ] Step indicator polish (Frame → Lens → Options → Preview)
- [ ] Swatch grids accessible (keyboard, labels)
- [ ] Preview step: CTA clarity (prescription vs ready-to-order)
- [ ] Performance on tint slider / category change

## Bracelet builder

- [ ] See [MILESTONE2_BRACELET_CHECKLIST.md](./MILESTONE2_BRACELET_CHECKLIST.md)

## Accessibility

- [ ] Focus rings on strand slots and controls
- [ ] `aria` labels on zoom toolbar and pan mode
- [ ] Colour contrast WCAG AA for primary text
- [ ] Reduced-motion respect for transitions

## Mobile

- [ ] Touch targets ≥ 44px on critical actions
- [ ] Library drawer pattern on small screens
- [ ] Strand zoom/pan usable with touch (pinch optional)

## Performance

- [ ] Code-split admin route
- [ ] Lazy-load heavy editor (PolygonEditor) in admin only
- [ ] Bundle size budget documented

## Testing

- [ ] Playwright smoke: three routes
- [ ] Vitest coverage for bracelet pricing + capacity hooks

## Verify

- Lighthouse accessibility ≥ 90 on `/bracelet` and `/sunglasses` (best effort)
- No React maximum-update-depth regressions
