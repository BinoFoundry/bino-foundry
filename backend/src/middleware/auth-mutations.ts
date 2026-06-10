import type { NextFunction, Request, Response } from "express";
import type { Permission } from "@bino-foundry/shared/types";

import { getEnv, isProductionLike } from "../config/env.js";
import { assertActiveSession, getProfileAccess } from "../lib/account-status.js";
import { ForbiddenError, UnauthorizedError } from "../lib/errors.js";
import { hasPermission, buildAuthUser, isAdminRole } from "../lib/rbac.js";
import { verifySupabaseAccessToken, type AuthPrincipal } from "./auth-jwt.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

async function jwtPrincipalFromBearer(bearer: string): Promise<Extract<AuthPrincipal, { scheme: "jwt" }> | null> {
  const user = await verifySupabaseAccessToken(bearer);
  if (!user) return null;
  const authUser = buildAuthUser(user);
  return {
    scheme: "jwt",
    userId: authUser.id,
    email: authUser.email ?? undefined,
    role: authUser.role,
    permissions: authUser.permissions,
    isAdmin: isAdminRole(authUser.role),
  };
}

/**
 * Catalogue mutation guard (admin):
 * - Production/staging: `ADMIN_API_KEY` or Bearer JWT with `catalogue.write`.
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
    const principal = await jwtPrincipalFromBearer(bearer);
    if (principal && hasPermission(principal.permissions, "catalogue.write")) {
      req.auth = principal;
      next();
      return;
    }
  }

  if (!adminKey && !isProductionLike()) {
    next();
    return;
  }

  next(new UnauthorizedError("Authentication required"));
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
    const principal = await jwtPrincipalFromBearer(bearer);
    if (principal) {
      req.auth = principal;
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

/** Requires any authenticated user JWT with an active account. */
export async function requireUserAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  let userId: string | undefined;

  if (req.auth?.scheme === "jwt" && req.auth.userId) {
    userId = req.auth.userId;
  } else {
    const bearer = normalizeBearer(req);
    if (bearer) {
      const principal = await jwtPrincipalFromBearer(bearer);
      if (principal) {
        req.auth = principal;
        userId = principal.userId;
      }
    }
  }

  if (!userId) {
    next(new UnauthorizedError("Sign in required"));
    return;
  }

  try {
    const access = await getProfileAccess(userId);
    assertActiveSession(access);
    next();
  } catch (err) {
    next(err);
  }
}

/** Requires a specific permission on the JWT principal. */
export function requirePermission(permission: Permission) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (req.auth?.scheme === "api-key") {
      next();
      return;
    }
    if (req.auth?.scheme === "jwt" && hasPermission(req.auth.permissions, permission)) {
      next();
      return;
    }
    next(new ForbiddenError("You do not have permission to perform this action"));
  };
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
