# Getting started

Local setup for Bino Foundry (npm workspaces: `frontend`, `backend`, `shared`).

## Prerequisites

- **Node.js** ≥ 18.18 ([`.nvmrc`](../../.nvmrc) pins Node 20)
- **npm** (comes with Node)
- **Supabase project** (Postgres + Storage) for full API/catalogue features

## 1. Clone and install

```bash
git clone <YOUR_REPO_URL>
cd bino-foundry
npm ci
```

## 2. Environment files

### API (repo root)

```bash
cp .env.example .env
```

Edit `.env`:

| Variable | Local dev |
|----------|-----------|
| `APP_ENV` | `development` |
| `NODE_ENV` | `development` |
| `PORT` | `5050` (avoid `5000` on macOS — AirPlay) |
| `SUPABASE_URL` | Your project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server only) |
| `CORS_ORIGINS` | Optional; dev auto-allows `http://localhost:8080` |
| `ADMIN_API_KEY` | Recommended if using admin saves / sunglasses config |

See [environment/README.md](../environment/README.md).

### Frontend

```bash
cp frontend/.env.example frontend/.env.development.local
```

```env
VITE_API_BASE_URL=http://localhost:5050
VITE_ADMIN_API_KEY=dev-secret   # must match ADMIN_API_KEY when set
```

## 3. Database (Supabase)

Apply SQL migrations in order — [setup/DATABASE.md](./DATABASE.md):

1. `000001_initial_catalog.sql`
2. `000002_storage_buckets_supabase.sql`
3. `000003_sunglasses_builder_catalog.sql`

Use Supabase **SQL Editor** or `psql`.

## 4. Validate configuration

```bash
npm run env:check
```

## 5. Run development servers

**Terminal 1 — API**

```bash
npm run dev:backend
```

**Terminal 2 — SPA**

```bash
npm run dev
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:8080 |
| Admin dashboard | http://localhost:8080/admin |
| API | http://localhost:5050 |
| Health | http://localhost:5050/api/status |
| Swagger UI | http://localhost:5050/api/docs |
| OpenAPI JSON | http://localhost:5050/api/openapi.json |

## 6. Smoke test

**API**

```bash
curl -s http://localhost:5050/api/status
curl -s http://localhost:5050/api/sunglasses/catalog | head -c 200
```

**SPA**

Open http://localhost:8080 — **Bracelet**, **Sunglasses**, and **Admin** load without CORS errors.

**Admin (optional)**

1. Open http://localhost:8080/admin
2. **Dashboard** shows frame/crystal/type counts
3. **Sunglasses config** — edit a tint if `ADMIN_API_KEY` + `VITE_ADMIN_API_KEY` are set
4. **Media** — upload a test image to staging

See [architecture/ADMIN.md](../architecture/ADMIN.md).

**Swagger**

Open http://localhost:5050/api/docs → **Authorize** with your `ADMIN_API_KEY` to try mutations. See [api/SWAGGER.md](../api/SWAGGER.md).

## Production-like local test (optional)

```bash
npm run build:all
APP_ENV=production npm run start:api:prod
curl -s http://localhost:5050/api/status   # expect appEnv: production
```

Use [deploy/README.md](../../deploy/README.md) for real staging/production deploys.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| CORS blocked from `:8080` | `APP_ENV=development`, restart `dev:backend`; see [environment/README.md](../environment/README.md) |
| API startup: catalogue unreachable | Run migrations; check `SUPABASE_*` |
| Port 5000 returns AirTunes | Use `PORT=5050` |
| Sunglasses catalog empty | Apply `000003` migration |
| Admin save returns 401 | Match `ADMIN_API_KEY` and `VITE_ADMIN_API_KEY`; restart both servers |
| Staging upload fails | Storage migration `000002`; service role key; check Network tab |

## Next steps

- [Development workflow](../development/WORKFLOW.md)
- [Architecture overview](../architecture/OVERVIEW.md)
- [Admin architecture](../architecture/ADMIN.md)
- [API guide](../api/README.md)
