import type { NextFunction, Request, Response } from "express";

import { getEnv } from "../config/env.js";
import { HttpError } from "../lib/errors.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const buckets = new Map<string, { count: number; resetAt: number }>();

/** Basic in-memory rate limit for mutation methods per IP. */
export function mutationRateLimit(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const limit = getEnv().RATE_LIMIT_MUTATIONS_PER_MIN;
  if (limit <= 0) {
    next();
    return;
  }

  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const key = `${ip}`;
  const now = Date.now();
  const windowMs = 60_000;

  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
    next(new HttpError(429, "RATE_LIMITED", "Too many requests — please try again shortly"));
    return;
  }

  next();
}
