/**
 * Client-side runtime config (Vite).
 * Prefer `VITE_API_BASE_URL` for the backend origin (no trailing slash).
 */

/** Express catalogue mount (align with backend `/api` · `/api/v1`). */
const DEFAULT_PUBLIC_API_PREFIX = "/api";

/** Local dev default when API runs on a non-AirPlay port (see root `.env.example`). */
const DEFAULT_DEV_API_ORIGIN = "http://localhost:5050";

export interface AppConfig {
  apiBaseUrl: string;
  apiPrefix: string;
  adminApiKey: string | undefined;
  isDev: boolean;
}

let cachedConfig: AppConfig | null = null;

export function getAppConfig(): AppConfig {
  if (!cachedConfig) {
    cachedConfig = {
      apiBaseUrl: getApiBaseUrl(),
      apiPrefix: getApiPublicPrefix(),
      adminApiKey: getAdminApiKey(),
      isDev: import.meta.env.DEV,
    };
  }
  return cachedConfig;
}

/** Base URL of the Express API. Empty string → same-origin relative requests. */
export function getApiBaseUrl(): string {
  const url =
    import.meta.env.VITE_API_BASE_URL?.trim?.() ||
    import.meta.env.VITE_BACKEND_URL?.trim?.() ||
    "";

  const fallback =
    url.length > 0
      ? url
      : typeof window !== "undefined" &&
          (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
        ? DEFAULT_DEV_API_ORIGIN
        : "";

  return fallback.replace(/\/$/, "");
}

export function getApiPublicPrefix(): string {
  const override = import.meta.env.VITE_API_PREFIX?.trim?.();
  const p =
    override && override.length > 0
      ? override
      : typeof import.meta.env.VITE_API_VERSION_PREFIX === "string" &&
          import.meta.env.VITE_API_VERSION_PREFIX.trim().length > 0
        ? import.meta.env.VITE_API_VERSION_PREFIX.trim()
        : DEFAULT_PUBLIC_API_PREFIX;
  const withSlash = p.startsWith("/") ? p : `/${p}`;
  return withSlash.replace(/\/$/, "");
}

/** Optional admin key for catalogue mutations (matches backend `ADMIN_API_KEY`). */
export function getAdminApiKey(): string | undefined {
  const key = import.meta.env.VITE_ADMIN_API_KEY?.trim();
  return key && key.length > 0 ? key : undefined;
}

/** Build full URL for a catalogue route segment, e.g. `resolveApiUrl("/frames")`. */
export function resolveApiUrl(path: string): string {
  const base = getApiBaseUrl();
  const prefix = getApiPublicPrefix();
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!base) return `${prefix}${p}`;
  return `${base}${prefix}${p}`;
}
