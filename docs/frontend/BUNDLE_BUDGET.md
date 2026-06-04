# Frontend bundle budget (M2)

Measured after `npm run build` in `frontend/` (production, Vite 5).

## Targets

| Chunk | Budget (gzip) | Notes |
|-------|----------------|-------|
| Main customer SPA (`index-*.js`) | ≤ 200 KB | Bracelet + sunglasses on initial route |
| CSS (`index-*.css`) | ≤ 20 KB | Tailwind + tokens |
| Admin (lazy) | Separate async chunk | Loaded only on `/admin` |

## Current practice

- `React.lazy` for `AdminApp` in `pages/Index.tsx`
- `React.lazy` for `FrameMaskEditor` / polygon editor shell in admin frames UI
- Polygon editor (`render/mask/PolygonEditor`) not imported on customer routes

## When to split further

- Sunglasses admin catalog if main chunk exceeds budget
- `recharts` if pulled into customer routes (admin-only today)

Re-run `npm run build` and compare `dist/assets/*.js` gzip lines after major features.
