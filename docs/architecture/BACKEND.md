# Backend architecture

Package: `@bino-foundry/backend` (Express 5 + TypeScript).

## Request lifecycle

```
HTTP request
  → requestContextMiddleware (request id)
  → cors
  → express.json
  → /api | /api/v1
       → GET {base}/openapi.json
       → {base}/docs (Swagger UI)
       → health routes (no auth)
       → catalog routes
            → requireMutationApiKey (GET open; POST/PUT/DELETE need x-api-key if ADMIN_API_KEY set)
            → module routers
  → NotFoundError
  → errorHandler (JSON envelope)
```

## Directory layout

```
src/
├── server.ts              # Bootstrap, Supabase verify, listen
├── app.ts                 # Express app, OpenAPI + docs mount
├── config/
│   ├── load-env.ts        # Layered .env loading
│   └── env.ts             # Zod schema, CORS allowlist
├── openapi/
│   ├── document.ts        # OpenAPI root + tags
│   ├── schemas.ts         # Components, security helpers
│   └── paths.ts           # Path operations
├── routes/
│   ├── health.routes.ts
│   ├── docs.routes.ts     # swagger-ui-express
│   └── catalog.routes.ts  # Composes module routers
├── modules/
│   ├── frames/
│   ├── crystals/
│   ├── types/
│   ├── sunglasses/        # Builder catalog (tints, options, colours)
│   └── upload/
├── infra/
│   ├── supabase/          # Admin client, catalog verify
│   ├── storage/           # Object storage helpers
│   └── cloudinary.ts      # Optional upload fallback
├── middleware/            # auth, multer, errors
└── lib/                   # errors, validation, http-response
```

## Module pattern

Each domain follows:

| File | Role |
|------|------|
| `*.validation.ts` | Zod DTOs |
| `*.service.ts` | Supabase queries, mapping |
| `*.controller.ts` | HTTP handlers |
| `*.routes.ts` | Express router |

## OpenAPI / Swagger

Hand-maintained spec under `src/openapi/`. Served without auth:

- `GET /api/openapi.json`
- `/api/docs` — Swagger UI with `persistAuthorization`

When adding routes, update `paths.ts` and [docs/api/ENDPOINTS.md](../api/ENDPOINTS.md). See [docs/api/SWAGGER.md](../api/SWAGGER.md).

## Supabase usage

- **Single admin client** — `SUPABASE_SERVICE_ROLE_KEY` (never exposed to SPA)
- **Tables** — [setup/DATABASE.md](../setup/DATABASE.md)
- **Storage** — [assets/WORKFLOW.md](../assets/WORKFLOW.md)

## Auth model (Phase 1)

- **Read** (GET/HEAD/OPTIONS): public
- **Write**: requires `x-api-key` when `ADMIN_API_KEY` is configured
- Admin SPA sends the same key via `VITE_ADMIN_API_KEY`
- Future: JWT / Supabase RLS for end-user orders; route guard for `/admin`

## Build & run

| Command | Output |
|---------|--------|
| `npm run dev` | `tsx watch src/server.ts` |
| `npm run build` | `dist/server.js` |
| `npm run start:prod` | `node dist/server.js` |

Startup logs include docs URLs (`server.ts`).

## Related

- [API endpoints](../api/ENDPOINTS.md)
- [Environment](../environment/README.md)
- [Admin architecture](./ADMIN.md)
