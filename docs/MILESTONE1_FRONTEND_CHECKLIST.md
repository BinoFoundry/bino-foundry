## Milestone 1 · Frontend foundation

- [x] **Config** — `src/config/env.ts` (`getAppConfig`, `resolveApiUrl`, `VITE_ADMIN_API_KEY`)
- [x] **API layer** — `src/services/api/` (`apiRequest`, `catalogueApi`, `uploadApi`, `ApiError`)
- [x] **State** — `src/state/catalogue/` (`CatalogueProvider`, `useCatalogue`, localStorage merge)
- [x] **Providers** — `src/providers/AppProviders.tsx` (QueryClient + catalogue + render + UI)
- [x] **Layouts** — `AppShell`, `BuilderViewport`, responsive header/nav (`100dvh`)
- [x] **Render prep** — `src/render/` types + `RenderProvider` + placeholder facade
- [x] **Common UI** — `LoadingState`, `ErrorState`, `ResponsiveContainer`
- [x] **Responsive CSS** — `builder-split`, safe-area, layout tokens in `index.css`

### Verify

1. `frontend/.env.development.local` → `VITE_API_BASE_URL` matches backend `PORT`.
2. `npm run dev:backend` + `npm run dev` — app loads, catalogue hydrates from API.
3. Admin upload uses `uploadApi` (Cloudinary path until Storage promotion UI lands).
