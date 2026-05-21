# Milestone 1 — Backend foundation

| Deliverable | Status |
|-------------|--------|
| TypeScript API (`tsx` dev, `tsc` → `dist/`) | Done |
| Zod-validated env (`config/env.ts` + existing multi-path `.env`) | Done |
| Layered domains under `modules/*` (+ `validation` · `service` · `controller` · `routes`) | Done |
| Shared HTTP helpers (`lib/errors.ts`, `http-response.ts`, `validation.ts`) | Done |
| Middleware: correlation id, selective CORS, mutation API key gate, multipart, global errors | Done |
| Dual mount `/api` + `/api/v1` catalogue surface | Done |
| Route factories prevent duplicate-handler bugs when versioning | Done |

Next steps for later milestones: wire Supabase repository layer, unify success envelope, bearer/JWT replacing simple API keys.
