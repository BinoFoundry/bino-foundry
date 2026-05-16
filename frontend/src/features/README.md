# Features (Phase 1 scaffold)

Migrate route-level builders here when refactoring boundaries:

```
features/
  bracelet/     # BeadLibrary, CircularStrand, BraceletBuilder
  sunglasses/   # FrameLibrary, LensRenderer, AdvancedSunglassesBuilder
  admin/        # AdminApp, layout, product/pricing/media modules
```

Until migration, builders live under `src/components/` and consume:

- `@/state/catalogue` — catalogue data + mutations
- `@/services/api` — direct API access when needed
- `@/render` — compositing facade
