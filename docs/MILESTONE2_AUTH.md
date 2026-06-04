# Milestone 2 — Authentication strategy

## Model

| Client | Reads (GET) | Writes (POST/PUT/PATCH/DELETE) |
|--------|---------------|--------------------------------|
| SPA builders | Open (no key) | Catalogue admin: `x-api-key` **or** Supabase JWT with `role: admin` |
| Bracelet save | Open load by `public_id` | `x-api-key` **or** user JWT **or** dev with no key |
| Bracelet list (mine) | — | User JWT only |
| Direct Supabase (anon) | RLS: active catalogue rows | **Denied** (no write policies) |

Express uses **`SUPABASE_SERVICE_ROLE_KEY`** for all database writes. The service role bypasses RLS.

## Supabase JWT

1. Create users in Supabase Auth.
2. Set admin: `app_metadata.role = "admin"` or `user_metadata.role = "admin"`.
3. SPA sends `Authorization: Bearer <access_token>` on protected calls.

Env: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (required for JWT verification in API).

## Admin API key

Env: `ADMIN_API_KEY` (required in staging/production).

Header: `x-api-key: <secret>` on mutations.

## Production

- `ADMIN_API_KEY` enforced via `env.ts` when `APP_ENV` is staging/production.
- Apply migration `000014_auth_rls_m2.sql` before exposing anon key to clients.

See also [architecture/BACKEND.md](./architecture/BACKEND.md), [setup/DATABASE.md](./setup/DATABASE.md).
