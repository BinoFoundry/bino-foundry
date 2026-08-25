import { z } from "zod";

const emptyAsUndefined = (raw: unknown) => {
  if (typeof raw !== "string") return raw;
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
};

const appEnvSchema = z.enum(["development", "test", "staging", "production"]);

const envSchema = z
  .object({
    APP_ENV: appEnvSchema.default("development"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(5050),
    /** Bind address; production defaults to 127.0.0.1 for nginx on the same host */
    LISTEN_HOST: z.preprocess(emptyAsUndefined, z.string().optional()),
    /** When set, non-GET catalogue/upload mutations must send matching `x-api-key` */
    ADMIN_API_KEY: z.preprocess(emptyAsUndefined, z.string().optional()),
    CLOUDINARY_CLOUD_NAME: z.preprocess(emptyAsUndefined, z.string().optional()),
    CLOUDINARY_API_KEY: z.preprocess(emptyAsUndefined, z.string().optional()),
    CLOUDINARY_API_SECRET: z.preprocess(emptyAsUndefined, z.string().optional()),
    /** Comma-separated origins; required in staging/production when SPA is on another host */
    CORS_ORIGINS: z.preprocess(emptyAsUndefined, z.string().optional()),
    SUPABASE_URL: z.preprocess(emptyAsUndefined, z.string().url().optional()),
    SUPABASE_ANON_KEY: z.preprocess(emptyAsUndefined, z.string().optional()),
    SUPABASE_SERVICE_ROLE_KEY: z.preprocess(emptyAsUndefined, z.string().optional()),
    /** Public SPA origin for auth email links (password reset, email verification). */
    PUBLIC_APP_URL: z.preprocess(emptyAsUndefined, z.string().url().optional()),
    /** Secret for signing application JWT access tokens */
    JWT_SECRET: z.preprocess(emptyAsUndefined, z.string().min(32).optional()),
    /** Base64-encoded 32-byte key for encrypting SMTP credentials at rest */
    SETTINGS_ENCRYPTION_KEY: z.preprocess(emptyAsUndefined, z.string().optional()),
    /** Access token lifetime in seconds (default 15 minutes) */
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    /** Refresh token lifetime in days (default 30) */
    JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
    /** Max mutation requests per IP per minute (0 = disabled) */
    RATE_LIMIT_MUTATIONS_PER_MIN: z.coerce.number().int().min(0).default(120),
    /** Set to `1` or `true` when API sits behind nginx/Caddy TLS termination */
    TRUST_PROXY: z
      .preprocess((v) => v === "1" || v === "true" || v === true, z.boolean())
      .default(false),
    /**
     * Swagger UI + `/openapi.json`. Default: on in development/test, off in staging/production.
     * Set `1`/`true` only for temporary private debugging (still avoid exposing publicly).
     */
    ENABLE_API_DOCS: z
      .preprocess((v) => {
        if (v === undefined || v === "") return undefined;
        if (v === "1" || v === "true" || v === true) return true;
        if (v === "0" || v === "false" || v === false) return false;
        return undefined;
      }, z.boolean().optional()),
  })
  .superRefine((data, ctx) => {
    const needsSupabase = data.APP_ENV === "staging" || data.APP_ENV === "production";
    if (!needsSupabase) return;

    if (!data.SUPABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SUPABASE_URL is required when APP_ENV is staging or production",
        path: ["SUPABASE_URL"],
      });
    }
    if (!data.SUPABASE_SERVICE_ROLE_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SUPABASE_SERVICE_ROLE_KEY is required when APP_ENV is staging or production",
        path: ["SUPABASE_SERVICE_ROLE_KEY"],
      });
    }
    if (!data.CORS_ORIGINS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CORS_ORIGINS is required when APP_ENV is staging or production",
        path: ["CORS_ORIGINS"],
      });
    }
    if (!data.ADMIN_API_KEY?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ADMIN_API_KEY is required when APP_ENV is staging or production",
        path: ["ADMIN_API_KEY"],
      });
    }
    if (!data.JWT_SECRET?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "JWT_SECRET is required when APP_ENV is staging or production",
        path: ["JWT_SECRET"],
      });
    }
    if (!data.SETTINGS_ENCRYPTION_KEY?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SETTINGS_ENCRYPTION_KEY is required when APP_ENV is staging or production",
        path: ["SETTINGS_ENCRYPTION_KEY"],
      });
    }
  });

export type BackendEnv = z.infer<typeof envSchema>;
export type AppEnv = z.infer<typeof appEnvSchema>;

let cached: BackendEnv | null = null;

export function getEnv(): BackendEnv {
  if (!cached) {
    cached = envSchema.parse(process.env);
  }
  return cached;
}

export function isProductionLike(): boolean {
  const env = getEnv().APP_ENV;
  return env === "production" || env === "staging";
}

/** OpenAPI UI/spec — private by default outside local development. */
export function areApiDocsEnabled(): boolean {
  const env = getEnv();
  if (env.ENABLE_API_DOCS !== undefined) return env.ENABLE_API_DOCS;
  return env.APP_ENV === "development" || env.APP_ENV === "test";
}

/** Where Express listens. Production/staging default 127.0.0.1 (matches nginx upstream). */
export function resolveListenHost(): string | undefined {
  const explicit = getEnv().LISTEN_HOST?.trim();
  if (explicit) return explicit;
  return isProductionLike() ? "127.0.0.1" : undefined;
}

/** Vite dev server + common local ports (always merged in APP_ENV=development). */
export const LOCAL_DEV_CORS_ORIGINS = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
] as const;

export function resolvePublicAppUrl(): string {
  const configured = getEnv().PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const origins = corsOriginAllowlist();
  if (origins?.length) return origins[0].replace(/\/$/, "");
  return "http://localhost:8080";
}

export function corsOriginAllowlist(): string[] | undefined {
  const raw = getEnv().CORS_ORIGINS?.trim();
  const fromEnv = raw
    ? raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  if (getEnv().APP_ENV === "development") {
    const merged = [...new Set([...LOCAL_DEV_CORS_ORIGINS, ...fromEnv])];
    return merged.length ? merged : undefined;
  }

  return fromEnv.length ? fromEnv : undefined;
}
