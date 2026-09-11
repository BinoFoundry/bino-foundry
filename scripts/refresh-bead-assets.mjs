#!/usr/bin/env node
/**
 * Headless runner for Admin → Bead sizes → Refresh bead assets.
 *
 * Starts local API if needed (same Supabase as root `.env`) + Vite on :8080,
 * opens `/dev/refresh-bead-assets?force=1`, waits until the job finishes.
 *
 * Usage (repo root):
 *   npm run refresh:bead-assets
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function loadEnvFile(file) {
  try {
    const text = readFileSync(file, "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      if (process.env[m[1]] !== undefined) continue;
      let v = m[2].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      process.env[m[1]] = v;
    }
  } catch {
    // optional
  }
}

loadEnvFile(resolve(ROOT, ".env"));
loadEnvFile(resolve(ROOT, "frontend/.env.development.local"));

const API_BASE_URL = (
  process.env.API_BASE_URL ||
  process.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:5050"
).replace(/\/$/, "").replace("localhost", "127.0.0.1");

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || process.env.VITE_ADMIN_API_KEY || "";
if (!ADMIN_API_KEY) {
  console.error("Missing ADMIN_API_KEY (or VITE_ADMIN_API_KEY)");
  process.exit(1);
}

const children = [];
let ownsApi = false;

async function waitForUrl(url, timeoutMs = 180_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function spawnLogged(command, args, options) {
  const child = spawn(command, args, options);
  children.push(child);
  const tag = options.tag || command;
  child.stdout?.on("data", (buf) => process.stdout.write(`[${tag}] ${buf}`));
  child.stderr?.on("data", (buf) => process.stderr.write(`[${tag}] ${buf}`));
  return child;
}

function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(130);
});

const isLocalApi = API_BASE_URL.includes("127.0.0.1");
const apiStatusUrl = `${API_BASE_URL}/api/status`;

if (isLocalApi) {
  let up = false;
  try {
    up = (await fetch(apiStatusUrl)).ok;
  } catch {
    up = false;
  }
  if (up) {
    console.log("Local API already running");
  } else {
    console.log("Starting local API…");
    ownsApi = true;
    spawnLogged("npm", ["run", "dev:backend"], {
      cwd: ROOT,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
      tag: "api",
    });
    await waitForUrl(apiStatusUrl);
    console.log("API ready");
  }
}

// Port 8080 is in backend LOCAL_DEV_CORS_ORIGINS.
const vitePort = Number(process.env.VITE_PORT || 8080);
const origin = `http://127.0.0.1:${vitePort}`;

console.log(`API:  ${API_BASE_URL}`);
console.log(`Vite: ${origin}`);

spawnLogged(
  "npx",
  ["vite", "--host", "127.0.0.1", "--port", String(vitePort), "--strictPort"],
  {
    cwd: resolve(ROOT, "frontend"),
    env: {
      ...process.env,
      VITE_API_BASE_URL: API_BASE_URL,
      VITE_ADMIN_API_KEY: ADMIN_API_KEY,
    },
    stdio: ["ignore", "pipe", "pipe"],
    tag: "vite",
  },
);

try {
  await waitForUrl(origin);
  // Confirm API still healthy before opening the page (avoids race with API restart).
  await waitForUrl(apiStatusUrl, 60_000);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(0);

  page.on("console", (msg) => {
    if (msg.type() === "error") console.error(`[browser] ${msg.text()}`);
  });

  console.log("Opening /dev/refresh-bead-assets?force=1 …");
  await page.goto(`${origin}/dev/refresh-bead-assets?force=1`, { waitUntil: "domcontentloaded" });

  const heartbeat = setInterval(async () => {
    try {
      const snap = await page.evaluate(() => window.__BEAD_ASSET_REFRESH__ ?? null);
      if (snap?.progress) {
        const p = snap.progress;
        console.log(
          `[progress] ${snap.status} ${p.done}/${p.total} saved=${p.saved} failed=${p.failed} skipped=${p.skipped} — ${p.currentLabel ?? ""}`,
        );
      } else {
        console.log(`[progress] ${snap?.status ?? "waiting"}`);
      }
    } catch {
      // page closed
    }
  }, 15_000);

  const resultHandle = await page.waitForFunction(
    () => {
      const state = window.__BEAD_ASSET_REFRESH__;
      if (!state) return null;
      if (state.status === "completed" || state.status === "failed" || state.status === "cancelled") {
        return state;
      }
      return null;
    },
    { timeout: 60 * 60 * 1000 },
  );

  clearInterval(heartbeat);

  const finalState = await resultHandle.jsonValue();
  console.log(JSON.stringify(finalState, null, 2));

  await browser.close();

  if (finalState?.status !== "completed") {
    process.exitCode = 1;
  }
} finally {
  // Always stop Vite; only stop API if we started it.
  for (const child of children) {
    const isApi = (child.spawnargs || []).some((a) => String(a).includes("dev:backend"));
    if (isApi && !ownsApi) continue;
    if (!child.killed) child.kill("SIGTERM");
  }
}
