# Architecture overview

Bino Foundry is a **monorepo** for a jewellery customiser: bracelet builder, sunglasses customiser, and admin catalogue.

## High-level diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (Vite SPA · localhost:8080 or CDN)                      │
│  React · builders · features/admin · render engine               │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS / JSON
                             │ /api/*  /api/v1/*
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Express API (Node · port 5050)                                  │
│  Modules: frames, crystals, types, sunglasses, upload            │
│  OpenAPI: /api/docs · /api/openapi.json                          │
│  Service role · no business logic in Supabase Edge (Phase 1)     │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
┌──────────────────────────┐   ┌──────────────────────────┐
│  Supabase Postgres       │   │  Supabase Storage         │
│  Catalogue + pricing     │   │  frames, crystals, assets │
│  sunglasses_builder_*    │   │  uploads (private staging)  │
└──────────────────────────┘   └──────────────────────────┘
```

## Design principles (Phase 1)

| Principle | Implementation |
|-----------|----------------|
| Frontend/backend separation | SPA only talks HTTP; secrets stay on API |
| Supabase = data plane only | Postgres + Storage; no vendor-specific app runtime |
| Vendor-neutral deploy | Static SPA (Vercel or nginx) + API (VPS/Docker/PM2) |
| Modular API | `backend/src/modules/<domain>/` |
| Modular admin | `frontend/src/features/admin/` |
| Shared contracts | `@bino-foundry/shared` for storage paths and constants |
| Documented API | Hand-maintained OpenAPI + Swagger UI |

## Workspaces

| Package | Role |
|---------|------|
| `@bino-foundry/frontend` | Vite + React 18, Tailwind, shadcn/ui |
| `@bino-foundry/backend` | Express 5, Zod env, Supabase client |
| `@bino-foundry/shared` | Storage path builders, shared constants |

## Major features

| Feature | Frontend | Backend / data |
|---------|----------|----------------|
| Bracelet builder | `BraceletBuilder`, bead catalogue | `crystals`, `crystal_types` |
| Sunglasses customiser | `features/sunglasses/`, `render/` | `frames`, `sunglasses_*` tables |
| Admin dashboard | `features/admin/AdminApp` | CRUD + `ADMIN_API_KEY`; see [ADMIN.md](./ADMIN.md) |
| Uploads | Admin Media + forms | `POST /api/upload/staging`, `/upload` |

## API versioning

Both prefixes mount the same router:

- `/api/...`
- `/api/v1/...`

New integrations may prefer `/api/v1`. OpenAPI `servers` lists both.

## Deeper reading

- [Frontend architecture](./FRONTEND.md)
- [Backend architecture](./BACKEND.md)
- [Admin architecture](./ADMIN.md)
- [API guide](../api/README.md)
- [Asset workflow](../assets/WORKFLOW.md)
