# Bino Foundry

Monorepo for a custom jewellery platform: **bracelet builder**, **sunglasses customiser**, and **admin catalogue**.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Vite, React 18, TypeScript, Tailwind, shadcn/ui |
| Backend | Express 5, TypeScript, Zod |
| Data | Supabase (Postgres + Storage only) |
| Shared | `@bino-foundry/shared` — types, storage path helpers |
| API docs | OpenAPI 3 + Swagger UI at `/api/docs` |

## Quick start

```bash
npm ci
cp .env.example .env              # fill SUPABASE_* etc.
cp frontend/.env.example frontend/.env.development.local
# Apply database/migrations/*.sql in Supabase (see docs)
npm run env:check
npm run dev:backend               # :5050
npm run dev                       # :8080
```

Full guide: **[docs/setup/GETTING_STARTED.md](./docs/setup/GETTING_STARTED.md)**

| URL (local) | Purpose |
|-------------|---------|
| http://localhost:8080 | SPA (builders + admin) |
| http://localhost:8080/admin | Admin dashboard |
| http://localhost:5050/api/status | API health |
| http://localhost:5050/api/docs | Swagger UI |

## Documentation

**[docs/README.md](./docs/README.md)** — central index

| Topic | Doc |
|-------|-----|
| Setup | [docs/setup/GETTING_STARTED.md](./docs/setup/GETTING_STARTED.md) |
| Architecture | [docs/architecture/OVERVIEW.md](./docs/architecture/OVERVIEW.md) |
| Admin | [docs/architecture/ADMIN.md](./docs/architecture/ADMIN.md) |
| API | [docs/api/README.md](./docs/api/README.md) |
| Swagger | [docs/api/SWAGGER.md](./docs/api/SWAGGER.md) |
| Environment | [docs/environment/README.md](./docs/environment/README.md) |
| Development | [docs/development/WORKFLOW.md](./docs/development/WORKFLOW.md) |
| Assets / Storage | [docs/assets/WORKFLOW.md](./docs/assets/WORKFLOW.md) |
| Deploy | [deploy/README.md](./deploy/README.md) |
| **Milestone 1 (done)** | [docs/MILESTONE1_SIGNOFF.md](./docs/MILESTONE1_SIGNOFF.md) |
| **Milestone 2 (active)** | [docs/MILESTONE2_OVERVIEW.md](./docs/MILESTONE2_OVERVIEW.md) |

## Repository layout

```
bino-foundry/
├── frontend/     # SPA (@bino-foundry/frontend)
│   └── src/features/admin/   # Admin dashboard module
├── backend/      # API (@bino-foundry/backend)
│   └── src/openapi/          # OpenAPI spec (Swagger)
├── shared/       # Shared package
├── database/     # SQL migrations + storage layout
├── docs/         # Developer documentation
├── deploy/       # Deployment configs (Docker, nginx, PM2)
└── scripts/      # Build / env check scripts
```

## Common commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Frontend dev server |
| `npm run dev:backend` | API dev server |
| `npm run build:all` | Production build (all workspaces) |
| `npm run env:check` | Validate environment |
| `npm run test` | Frontend tests |

## Deploy

- **SPA:** Vercel or static host (`frontend/dist`) — see [deploy/README.md](./deploy/README.md)
- **API:** VPS, Docker, or PM2 — vendor-neutral; not tied to Vercel

## License

Private — All rights reserved (adjust as needed for your org).
