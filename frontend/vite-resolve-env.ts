import path from "node:path";
import { loadEnv } from "vite";

import { mergeFrontendViteEnv } from "./src/config/vite-env-merge";

/**
 * Resolve SPA `VITE_*` from both repo-root and `frontend/` env files.
 *
 * Why: Vite only has one `envDir`. Docs historically pointed at `frontend/.env*`,
 * while this monorepo also keeps secrets in the root `.env` (with `ADMIN_API_KEY`).
 * Merging both prevents “key set in one file but missing in the SPA” failures.
 *
 * In local development only, an unset `VITE_ADMIN_API_KEY` falls back to root
 * `ADMIN_API_KEY` so catalogue writes send a matching `x-api-key`. Deployed
 * builds never inherit it — see mergeFrontendViteEnv.
 */
export function resolveFrontendViteEnv(mode: string, frontendDir: string) {
  const repoRoot = path.resolve(frontendDir, "..");
  const rootEnv = loadEnv(mode, repoRoot, "");
  const frontendEnv = loadEnv(mode, frontendDir, "");
  return mergeFrontendViteEnv({ frontendEnv, rootEnv, mode });
}
