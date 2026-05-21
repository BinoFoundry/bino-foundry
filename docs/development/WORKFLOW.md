# Development workflow

Day-to-day commands and practices for Bino Foundry contributors.

## Daily loop

```bash
# Once per machine / after pull
npm ci
npm run env:check

# Terminal A
npm run dev:backend    # API :5050

# Terminal B
npm run dev            # SPA :8080
```

| URL | Use |
|-----|-----|
| http://localhost:8080 | Builders |
| http://localhost:8080/admin | Admin dashboard |
| http://localhost:5050/api/docs | Swagger UI |

## Common commands (repo root)

| Script | Purpose |
|--------|---------|
| `npm run dev` | Frontend dev server |
| `npm run dev:backend` | API with hot reload (`tsx watch`) |
| `npm run build:all` | shared + backend + frontend production build |
| `npm run build:staging` | Frontend staging mode build |
| `npm run typecheck:backend` | Backend `tsc --noEmit` |
| `npm run test` | Frontend Vitest |
| `npm run lint` | Frontend ESLint |
| `npm run env:check` | Validate env schema |
| `npm run start:api:prod` | Run compiled API (`backend/dist`) |

## Workspace-specific

```bash
npm run dev -w @bino-foundry/frontend
npm run build -w @bino-foundry/backend
```

## What to run before a PR

```bash
npm run env:check
npm run build:all
npm run typecheck:backend
npm run test
npm run lint
```

CI runs the same on push (see [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)).

## Branching (suggested)

| Branch | Use |
|--------|-----|
| `main` | Stable / deployable |
| `feature/*` | New work |
| `fix/*` | Bug fixes |

## Adding a feature (checklist)

### API + database

1. SQL migration in `database/migrations/` (numbered).
2. Module under `backend/src/modules/`.
3. Register route in `catalog.routes.ts`.
4. Update `backend/src/openapi/paths.ts` (+ schemas).
5. Update [api/ENDPOINTS.md](../api/ENDPOINTS.md).

### Frontend

1. API client in `frontend/src/services/api/`.
2. State/hooks under `state/` or `features/`.
3. UI in `components/` or `features/`.
4. If admin-facing: wire `features/admin/` section — [architecture/ADMIN.md](../architecture/ADMIN.md).

### Shared

1. Constants/path helpers in `shared/src/` if used by both sides.

### Documentation

1. Same PR: env doc, endpoints, asset workflow, or admin doc as applicable.
2. See [docs/README.md](../README.md) maintenance table.

## Admin development

```env
# .env
ADMIN_API_KEY=dev-secret

# frontend/.env.development.local
VITE_ADMIN_API_KEY=dev-secret
```

| Task | Where |
|------|--------|
| Product CRUD (local) | `/admin` → Frames, Crystals, Types |
| API-backed pricing | `/admin` → Sunglasses config |
| Staging uploads | `/admin` → Media |
| Test API without UI | http://localhost:5050/api/docs |

Module guide: [`frontend/src/features/admin/README.md`](../../frontend/src/features/admin/README.md).

## Debugging

| Issue | Check |
|-------|--------|
| CORS | [environment/README.md](../environment/README.md), restart backend |
| 401 on admin save | `x-api-key` / `VITE_ADMIN_API_KEY` match |
| Empty catalogue | Migrations, Supabase keys, network tab |
| Sunglasses pricing | `GET /api/sunglasses/catalog`, admin Sunglasses config |
| Staging upload | `000002` migration, `POST /upload/staging`, Media section |
| Swagger mutation fails | Authorize in UI with `ADMIN_API_KEY` |

## Production smoke (local)

```bash
npm run build:all
APP_ENV=production npm run start:api:prod
```

Do **not** use this for daily UI work — use `dev:backend` + `dev`.

## Related

- [Getting started](../setup/GETTING_STARTED.md)
- [Architecture](../architecture/OVERVIEW.md)
- [Admin architecture](../architecture/ADMIN.md)
- [Asset workflow](../assets/WORKFLOW.md)
- [Swagger](../api/SWAGGER.md)
