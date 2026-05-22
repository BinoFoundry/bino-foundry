import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const BACKEND_ROOT = path.resolve(__dirname, "..", "..");

/** Vars set on the shell (npm script, docker, systemd) must win over `.env` files. */
const SHELL_PRESERVE_KEYS = [
  "APP_ENV",
  "NODE_ENV",
  "PORT",
  "LISTEN_HOST",
  "ADMIN_API_KEY",
  "CORS_ORIGINS",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TRUST_PROXY",
] as const;

function snapshotShellEnv(): Record<string, string> {
  const snap: Record<string, string> = {};
  for (const key of SHELL_PRESERVE_KEYS) {
    const value = process.env[key];
    if (value !== undefined && value !== "") {
      snap[key] = value;
    }
  }
  return snap;
}

function resolveAppEnv(): string {
  const raw = process.env.APP_ENV?.trim() || process.env.NODE_ENV?.trim() || "development";
  if (raw === "production" || raw === "staging" || raw === "development" || raw === "test") {
    return raw;
  }
  return "development";
}

function loadFile(filepath: string): void {
  if (!fs.existsSync(filepath)) return;
  dotenv.config({ path: filepath, override: true });
}

/**
 * Load env files (later files override earlier). Shell exports always win.
 */
export function loadEnv(): void {
  const shellSnapshot = snapshotShellEnv();
  const appEnv = resolveAppEnv();

  process.env.APP_ENV ??= appEnv;
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = appEnv === "development" ? "development" : "production";
  }

  const bases = [
    REPO_ROOT,
    path.resolve(REPO_ROOT, "deploy", "env"),
    BACKEND_ROOT,
    process.cwd(),
    path.resolve(process.cwd(), ".."),
  ];

  const filenames = [
    ".env",
    ".env.local",
    `.env.${appEnv}`,
    `.env.${appEnv}.local`,
  ];

  for (const base of bases) {
    for (const name of filenames) {
      loadFile(path.join(base, name));
    }
  }

  for (const [key, value] of Object.entries(shellSnapshot)) {
    process.env[key] = value;
  }
}

loadEnv();
