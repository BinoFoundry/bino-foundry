# Milestone 1 — Frontend foundation (completed)

SPA shell, API integration, and builder routes. Bracelet UX improvements during M1 are **foundation extensions**; further polish is Milestone 2.

## Core foundation

- [x] **Config** — `src/config/env.ts` (`getAppConfig`, `resolveApiUrl`, `VITE_ADMIN_API_KEY`)
- [x] **API layer** — `src/services/api/` (`apiRequest`, `catalogueApi`, `uploadApi`, `braceletApi`, `renderingApi`, `ApiError`)
- [x] **State** — `src/state/catalogue/`, `src/state/sunglasses-catalog/`
- [x] **Providers** — `AppProviders` (QueryClient, catalogue, sunglasses catalog, render, UI)
- [x] **Layouts** — `AppShell`, `BuilderViewport`, responsive nav (`100dvh`)
- [x] **Routes** — `/bracelet`, `/sunglasses`, `/admin` ([FRONTEND.md](./architecture/FRONTEND.md))
- [x] **Render module** — `src/render/` (compositor, not placeholder)
- [x] **Common UI** — `LoadingState`, `ErrorState`, `ResponsiveContainer`, shadcn `ui/`
- [x] **Responsive CSS** — `builder-split`, safe-area, theme tokens (`index.css`, `--strand-cord`)

## Feature modules

| Module | Path | M1 role |
|--------|------|---------|
| Sunglasses customiser | `features/sunglasses/` | Step flow + compositor integration |
| Bracelet builder | `features/bracelet/` + `BraceletBuilder.tsx` | Circular strand, pricing, save config |
| Admin | `features/admin/` | Catalogue, clips, media, bead sizes |

## Bracelet foundation extensions (usable builder, not final UX)

- [x] `SortableCircularStrand` — DnD, drop from library, circular layout
- [x] Strand guide (empty + partial fill), cord path (`STRAND_CORD` theme variables)
- [x] `useBraceletBuilder` — wrist/bead size capacity, twinning, pricing
- [x] `BraceletSummaryPanel`, save configuration via API
- [x] Admin-driven bead sizes (`useBraceletPricingRules`, catalogue hydration)
- [x] Zoom / pan viewport (`useStrandZoom`, `StrandViewport`, `StrandZoomControls`)
- [x] Remove bead (× control), duplicate first → second bracelet (twin mode)

## Verify

1. `frontend/.env.development.local` — `VITE_API_BASE_URL` → backend (e.g. `http://localhost:5050`).
2. `npm run dev:backend` + `npm run dev`.
3. **Sunglasses** — full step flow; price updates.
4. **Bracelet** — place beads, change wrist/size, twin + match first bracelet, save design.
5. **Admin** — frames clip editor, bead crop, bead sizes page, media staging.

## Milestone 2

Premium UI, configurator completeness, accessibility, performance — [MILESTONE2_FRONTEND_CHECKLIST.md](./MILESTONE2_FRONTEND_CHECKLIST.md), [MILESTONE2_BRACELET_CHECKLIST.md](./MILESTONE2_BRACELET_CHECKLIST.md).
