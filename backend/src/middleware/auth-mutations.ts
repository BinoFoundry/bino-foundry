import type { NextFunction, Request, Response } from "express";

import { getEnv, isProductionLike } from "../config/env.js";
import { UnauthorizedError } from "../lib/errors.js";
import { verifySupabaseAccessToken, isAdminUser, type AuthPrincipal } from "./auth-jwt.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Catalogue mutation guard (admin):
 * - Production/staging: `ADMIN_API_KEY` or Bearer JWT with `role: admin` in user/app metadata.
 * - Development without key: mutations allowed (local only).
 */
export async function requireMutationAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const adminKey = getEnv().ADMIN_API_KEY?.trim();
  const providedKey = normalizeApiKey(req);

  if (adminKey && providedKey === adminKey) {
    req.auth = { scheme: "api-key" };
    next();
    return;
  }

  const bearer = normalizeBearer(req);
  if (bearer) {
    const user = await verifySupabaseAccessToken(bearer);
    if (user && isAdminUser(user)) {
      req.auth = {
        scheme: "jwt",
        userId: user.id,
        email: user.email,
        isAdmin: true,
      };
      next();
      return;
    }
  }

  if (!adminKey && !isProductionLike()) {
    next();
    return;
  }

  next(new UnauthorizedError("Admin API key or admin JWT required for this action"));
}

/**
 * Bracelet save: API key, authenticated user JWT, or open in local dev when no admin key is set.
 */
export async function requireBraceletWriteAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const adminKey = getEnv().ADMIN_API_KEY?.trim();
  const providedKey = normalizeApiKey(req);

  if (adminKey && providedKey === adminKey) {
    req.auth = { scheme: "api-key" };
    next();
    return;
  }

  const bearer = normalizeBearer(req);
  if (bearer) {
    const user = await verifySupabaseAccessToken(bearer);
    if (user) {
      req.auth = {
        scheme: "jwt",
        userId: user.id,
        email: user.email,
        isAdmin: isAdminUser(user),
      };
      next();
      return;
    }
  }

  if (!adminKey && !isProductionLike()) {
    next();
    return;
  }

  next(new UnauthorizedError("Sign in or provide a valid API key to save designs"));
}

/** List own bracelet configs — requires user JWT (not API key alone). */
export async function requireUserAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (req.auth?.scheme === "jwt" && req.auth.userId) {
    next();
    return;
  }

  const bearer = normalizeBearer(req);
  if (bearer) {
    const user = await verifySupabaseAccessToken(bearer);
    if (user) {
      req.auth = {
        scheme: "jwt",
        userId: user.id,
        email: user.email,
        isAdmin: isAdminUser(user),
      };
      next();
      return;
    }
  }

  next(new UnauthorizedError("Sign in required"));
}

export function getAuthUserId(req: Request): string | undefined {
  return req.auth?.scheme === "jwt" ? req.auth.userId : undefined;
}

function normalizeApiKey(req: Request): string | undefined {
  const raw = typeof req.headers["x-api-key"] === "string" ? req.headers["x-api-key"] : undefined;
  if (raw?.startsWith("Bearer ")) {
    return raw.slice("Bearer ".length).trim();
  }
  return raw?.trim();
}

function normalizeBearer(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return undefined;
  return header.slice("Bearer ".length).trim() || undefined;
}

export type { AuthPrincipal };
