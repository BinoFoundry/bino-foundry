# Milestone 2 — Backend hardening & auth

API improvements for production launch and commerce support.

**Baseline (M1):** Express modules, Supabase service role, API key gate, bracelet + rendering + catalogue routes, OpenAPI.

## Authentication & authorization

- [ ] Define auth strategy (Supabase Auth JWT vs custom session)
- [ ] Protect admin mutations with verified identity (not shared static key only)
- [ ] Optional: public read, authenticated write per resource
- [ ] RLS policies on Supabase tables aligned with JWT claims
- [ ] Document service role usage (backend-only)

## API quality

- [ ] Unified success response envelope `{ data, meta }` (versioned `/api/v2` optional)
- [ ] Consistent error codes documented in [ERRORS.md](./api/ERRORS.md)
- [ ] Request validation coverage on all POST/PUT bodies
- [ ] Rate limiting on public endpoints (basic)

## Bracelet & designs

- [ ] `GET /bracelet/configurations/:id` for load saved design
- [ ] List configurations for authenticated user (when auth exists)
- [ ] Validate configuration items against current catalogue (bead still exists)
- [ ] Pricing recalculation endpoint for saved config refresh

## Rendering API

- [ ] Clip validation endpoint (path bounds, closed path)
- [ ] Batch fetch render views for frame picker

## Orders (prep — see Commerce checklist)

- [ ] `bracelet_configurations.status` transition `saved` → `ordered`
- [ ] Order stub table or external ID linkage (design only until Commerce scope)

## Operations

- [ ] Structured logging (request id already exists — add levels)
- [ ] Health check includes DB + storage connectivity
- [ ] Migration runner documented for CI/CD

## Testing

- [ ] Integration tests against Supabase test project or docker pg
- [ ] OpenAPI stays in sync with routes (CI check)

## Verify

- Auth flow blocks unauthenticated admin POST
- RLS prevents direct client write to catalogue tables with anon key
- Saved bracelet config round-trips through API

## References

- [architecture/BACKEND.md](./architecture/BACKEND.md)
- [setup/DATABASE.md](./setup/DATABASE.md)
