export type ViteEnvBag = {
  VITE_ADMIN_API_KEY: string;
  VITE_API_BASE_URL: string;
  VITE_API_PREFIX: string;
  VITE_BACKEND_URL: string;
};

export function pickEnvValue(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

/**
 * Merge SPA env from frontend-local + repo-root files. Frontend values win.
 *
 * `ADMIN_API_KEY` is mirrored in only for local development.
 *
 * Every `VITE_*` value is inlined into the JavaScript the browser downloads, so
 * mirroring the server's key unconditionally published it: it was readable in
 * the deployed bundle, and presenting it as `x-api-key` granted write access to
 * the whole catalogue with no login at all. Signed-in admins already hold a
 * bearer token carrying `catalogue.write` and the API client sends both, so
 * dropping the key from deployed builds costs them nothing.
 *
 * Wanting it in a deployed build now means setting `VITE_ADMIN_API_KEY`
 * deliberately, which reads as the export of a secret that it is.
 */
export function mergeFrontendViteEnv(input: {
  frontendEnv: Record<string, string>;
  rootEnv: Record<string, string>;
  mode?: string;
}): ViteEnvBag {
  const { frontendEnv, rootEnv, mode } = input;
  const localOnly = mode === undefined || mode === "development" || mode === "test";
  return {
    VITE_ADMIN_API_KEY: pickEnvValue(
      frontendEnv.VITE_ADMIN_API_KEY,
      rootEnv.VITE_ADMIN_API_KEY,
      localOnly ? rootEnv.ADMIN_API_KEY : undefined,
    ),
    VITE_API_BASE_URL: pickEnvValue(
      frontendEnv.VITE_API_BASE_URL,
      rootEnv.VITE_API_BASE_URL,
      frontendEnv.VITE_BACKEND_URL,
      rootEnv.VITE_BACKEND_URL,
    ),
    VITE_API_PREFIX: pickEnvValue(frontendEnv.VITE_API_PREFIX, rootEnv.VITE_API_PREFIX),
    VITE_BACKEND_URL: pickEnvValue(frontendEnv.VITE_BACKEND_URL, rootEnv.VITE_BACKEND_URL),
  };
}
