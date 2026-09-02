/**
 * The whole Express API as a single Netlify Function.
 *
 * `createApplication()` is deliberately separate from `app.listen()` in
 * server.ts, so the same app object that runs on a server also runs here
 * unchanged. netlify.toml routes /api/* here.
 *
 * `sharp` is declared external in netlify.toml — it ships native binaries that
 * cannot be bundled. It is used only by the sunglasses frame-crop export.
 */
import serverless from "serverless-http";
import { createApplication } from "../../backend/src/app.js";

// Deliberately NOT importing backend/src/config/load-env.js here. It reads .env
// files off disk via fileURLToPath(import.meta.url), which is undefined once
// esbuild bundles this function — it threw
// `TypeError: The "path" argument must be of type string` on every request.
// Netlify injects environment variables into process.env directly, and
// config/env.ts reads process.env, so there is nothing to load.

const inner = serverless(createApplication());

const FUNCTION_PREFIX = "/.netlify/functions/api";

/**
 * Normalise the request path before Express sees it.
 *
 * Depending on how the redirect resolves, Netlify delivers either the original
 * `/api/bead-types` or the rewritten `/.netlify/functions/api/bead-types`.
 * Express mounts its routes under `/api`, so the second form would 404. Rather
 * than depend on which arrives, strip the function prefix and guarantee exactly
 * one leading `/api`.
 */
export function normalisePath(path: string): string {
  let next = path.startsWith(FUNCTION_PREFIX) ? path.slice(FUNCTION_PREFIX.length) : path;
  if (!next.startsWith("/")) next = `/${next}`;
  if (next === "/") return "/api";
  return next === "/api" || next.startsWith("/api/") ? next : `/api${next}`;
}

export const handler = async (event: Record<string, unknown>, context: unknown) => {
  const original = typeof event.path === "string" ? event.path : "/";
  const path = normalisePath(original);
  const rawUrl = typeof event.rawUrl === "string" ? event.rawUrl : undefined;

  return inner(
    { ...event, path, rawUrl: rawUrl ? rawUrl.replace(original, path) : undefined },
    context,
  );
};
