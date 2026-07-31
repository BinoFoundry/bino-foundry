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
 * Merge SPA env from frontend-local + repo-root files.
 * Frontend values win. If `VITE_ADMIN_API_KEY` is still empty, mirror `ADMIN_API_KEY`.
 */
export function mergeFrontendViteEnv(input: {
  frontendEnv: Record<string, string>;
  rootEnv: Record<string, string>;
}): ViteEnvBag {
  const { frontendEnv, rootEnv } = input;
  return {
    VITE_ADMIN_API_KEY: pickEnvValue(
      frontendEnv.VITE_ADMIN_API_KEY,
      rootEnv.VITE_ADMIN_API_KEY,
      rootEnv.ADMIN_API_KEY,
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
