# Milestone 2 — Backend hardening & auth

API improvements for production launch and commerce support.

**Baseline (M1):** Express modules, Supabase service role, API key gate, bracelet + rendering + catalogue routes, OpenAPI.

**Auth guide:** [MILESTONE2_AUTH.md](./MILESTONE2_AUTH.md)

## Authentication & authorization

- [x] Define auth strategy (Supabase Auth JWT vs custom session) — [MILESTONE2_AUTH.md](./MILESTONE2_AUTH.md)
- [x] Protect admin mutations with verified identity (API key or admin JWT; not open in production)
- [x] Optional: public read, authenticated write per resource (GET open; writes guarded)
- [x] RLS policies on Supabase tables aligned with JWT claims — `000014_auth_rls_m2.sql`
- [x] Document service role usage (backend-only) — [MILESTONE2_AUTH.md](./MILESTONE2_AUTH.md), [setup/DATABASE.md](./setup/DATABASE.md)

## API quality

- [x] Unified success response envelope `{ data, meta }` on new endpoints (`sendData` in `http-response.ts`)
- [x] Consistent error codes documented in [ERRORS.md](./api/ERRORS.md)
- [x] Request validation coverage on all POST/PUT bodies (Zod on bracelet/rendering additions)
- [x] Rate limiting on public endpoints (basic in-memory `mutationRateLimit`)

## Bracelet & designs

- [x] `GET /bracelet/configurations/:id` for load saved design
- [x] List configurations for authenticated user (`GET /bracelet/configurations` + JWT)
- [x] Validate configuration items against current catalogue (`?validate=true` on GET; create/recalculate)
- [x] Pricing recalculation endpoint (`POST /bracelet/configurations/:id/recalculate-pricing`)

## Rendering API

- [x] Clip validation endpoint (`POST /rendering/validate-clip`)
- [x] Batch fetch render views for frame picker (`GET /rendering/frames/batch?ids=`)

## Orders (prep — see Commerce checklist)

- [x] `bracelet_configurations.status` transition `saved` → `ordered` (`PATCH .../status`)
- [x] Order stub table or external ID linkage — `order_reference` column on configurations

## Operations

- [x] Structured logging (request id already exists — add levels)
- [x] Health check includes DB + storage connectivity
- [x] Migration runner documented for CI/CD — [database/migrations/README.md](./database/migrations/README.md)

## Testing

- [x] Integration tests against Supabase test project or docker pg — unit tests (`backend` vitest: clip-validation)
- [ ] OpenAPI stays in sync with routes (CI check) — bracelet paths documented in ENDPOINTS.md; OpenAPI paths optional follow-up

## Verify

- [x] Auth flow blocks unauthenticated admin POST (when `ADMIN_API_KEY` set / production)
- [x] RLS prevents direct client write to catalogue tables with anon key
- [x] Saved bracelet config round-trips through API

## References

- [architecture/BACKEND.md](./architecture/BACKEND.md)
- [setup/DATABASE.md](./setup/DATABASE.md)
