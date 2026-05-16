import type { NextFunction, Request, Response } from "express";

import { getEnv } from "../config/env.js";
import { UnauthorizedError } from "../lib/errors.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Mutation guard: when `ADMIN_API_KEY` is configured, callers must submit `x-api-key`.
 * Read-only traffic stays open for SPA builders without extra headers.
 */
export function requireMutationApiKey(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const adminKey = getEnv().ADMIN_API_KEY?.trim();
  if (!adminKey) {
    next();
    return;
  }

  const provided = normalizeApiKey(req);
  if (provided === adminKey) {
    req.auth = { scheme: "api-key" };
    next();
    return;
  }

  next(new UnauthorizedError());
}

function normalizeApiKey(req: Request): string | undefined {
  const raw = typeof req.headers["x-api-key"] === "string" ? req.headers["x-api-key"] : undefined;
  if (raw?.startsWith("Bearer ")) {
    return raw.slice("Bearer ".length).trim();
  }
  return raw?.trim();
}
