# Bino Foundry — Frontend

Vite + React 18 + TypeScript + Tailwind + shadcn/ui.

## Architecture (`src/`)

| Path | Role |
|------|------|
| `config/` | Vite env (`VITE_*`), API base URL resolution |
| `services/api/` | HTTP client, catalogue CRUD, uploads (`ApiError`, `x-api-key`) |
| `state/catalogue/` | `CatalogueProvider` + `useCatalogue` (optimistic local + API sync) |
| `providers/` | `AppProviders` (React Query, catalogue, render, toasts) |
| `layouts/` | `AppShell`, `BuilderViewport`, module navigation |
| `render/` | 2D compositor (SVG clip + sunglasses customiser) — quality pass in M2 |
| `features/bracelet/` | Bracelet builder (strand, pricing, zoom/pan) |
| `components/ui/` | shadcn primitives |
| `components/common/` | Shared loading/error/responsive wrappers |
| `features/admin/` | Admin dashboard (`AdminApp`, products, pricing, media) |
| `features/sunglasses/` | Sunglasses customiser flow |
| `components/` | Builders + admin entity forms (`FrameForm`, …) |
| `hooks/` | Breakpoints, React Query catalogue hooks |
| `types/` | Shared TS contracts |
| `data/` | Static defaults + backward-compatible re-exports |
| `pages/` | Route entries |

## Environment

| File | Use |
|------|-----|
| `.env.development.local` | Local dev (`npm run dev`) |
| `.env.staging` | Staging build (`npm run build:staging`) |
| `.env.production` | Production / Vercel (`npm run build`) |

Copy from [`.env.example`](./.env.example), [`.env.staging.example`](./.env.staging.example), or [`.env.production.example`](./.env.production.example).

```bash
VITE_API_BASE_URL=http://localhost:5050
# Same-origin VPS (nginx proxies /api): leave empty
# VITE_ADMIN_API_KEY=   # required for /admin API saves when backend ADMIN_API_KEY is set
```

Admin: http://localhost:8080/admin — [docs/architecture/ADMIN.md](../docs/architecture/ADMIN.md)

Deployment: [../deploy/README.md](../deploy/README.md) · Docs: [../docs/README.md](../docs/README.md) · Vercel: [`vercel.json`](./vercel.json)

## Commands

```bash
npm run dev --workspace frontend
npm run build --workspace frontend
npm run build:staging --workspace frontend
npm run test --workspace frontend
```
