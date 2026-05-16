#!/usr/bin/env node
/**
 * Validate environment for the current APP_ENV (API + optional frontend hints).
 * Usage: npm run env:check
 *        APP_ENV=staging npm run env:check
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const appEnv = process.env.APP_ENV?.trim() || process.env.NODE_ENV?.trim() || "development";
const isStrict = appEnv === "staging" || appEnv === "production";

function loadDotEnvFiles() {
  const bases = [ROOT, path.join(ROOT, "deploy", "env"), path.join(ROOT, "backend")];
  const names = [".env", ".env.local", `.env.${appEnv}`, `.env.${appEnv}.local`];
  for (const base of bases) {
    for (const name of names) {
      const fp = path.join(base, name);
      if (!fs.existsSync(fp)) continue;
      const text = fs.readFileSync(fp, "utf8");
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) process.env[key] = val;
      }
    }
  }
}

loadDotEnvFiles();

const requiredStrict = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "CORS_ORIGINS"];
const recommendedStrict = ["ADMIN_API_KEY"];
const warnings = [];
const errors = [];

for (const key of requiredStrict) {
  if (isStrict && !process.env[key]?.trim()) {
    errors.push(`Missing required ${key} for APP_ENV=${appEnv}`);
  }
}

for (const key of recommendedStrict) {
  if (isStrict && !process.env[key]?.trim()) {
    warnings.push(`Missing recommended ${key} for APP_ENV=${appEnv}`);
  }
}

const frontendProd = path.join(ROOT, "frontend", `.env.${appEnv === "development" ? "development.local" : appEnv}`);
if (isStrict && !fs.existsSync(frontendProd) && !process.env.VITE_API_BASE_URL) {
  warnings.push(
    `No frontend/.env.${appEnv} and VITE_API_BASE_URL unset — set before \`npm run build -w frontend -- --mode ${appEnv}\``,
  );
}

console.log(`\nBino Foundry env check (APP_ENV=${appEnv})\n`);

if (warnings.length) {
  console.log("Warnings:");
  warnings.forEach((w) => console.log(`  ⚠ ${w}`));
}

if (errors.length) {
  console.error("\nErrors:");
  errors.forEach((e) => console.error(`  ✗ ${e}`));
  process.exit(1);
}

// Backend Zod parse via compiled path — run typecheck import
const result = spawnSync(
  "npx",
  ["tsx", "-e", "import './backend/src/config/load-env.ts'; import { getEnv } from './backend/src/config/env.ts'; console.log(JSON.stringify(getEnv()));"],
  { cwd: ROOT, encoding: "utf8", env: { ...process.env, APP_ENV: appEnv } },
);

if (result.status !== 0) {
  console.error("\nBackend env schema validation failed:");
  console.error(result.stderr || result.stdout);
  process.exit(1);
}

console.log("  ✓ Backend env schema OK");
console.log("\nDone.\n");
