import type { NextFunction, Request, Response } from "express";
import type { Permission, UserRole } from "@bino-foundry/shared/types";

import { findUserById } from "../infra/auth/user-repository.js";
import { UnauthorizedError } from "../lib/errors.js";
import { verifyAccessToken } from "../lib/jwt.js";
import { buildAuthUserFromDb, hasPermission, isAdminRole } from "../lib/rbac.js";

export type AuthPrincipal =
  | { scheme: "api-key" }
  | {
      scheme: "jwt";
      userId: string;
      email?: string;
      role: UserRole;
      permissions: Permission[];
      isAdmin: boolean;
    };

function bearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return undefined;
  const token = header.slice("Bearer ".length).trim();
  return token || undefined;
}

async function jwtPrincipalFromToken(token: string): Promise<Extract<AuthPrincipal, { scheme: "jwt" }> | null> {
  const payload = verifyAccessToken(token);
  if (!payload) return null;

  const user = await findUserById(payload.sub);
  if (!user || user.deletedAt) return null;

  const authUser = buildAuthUserFromDb(user);
  return {
    scheme: "jwt",
    userId: authUser.id,
    email: authUser.email ?? undefined,
    role: authUser.role,
    permissions: authUser.permissions,
    isAdmin: isAdminRole(authUser.role),
  };
}

/** Verify application access token and return JWT payload. */
export async function verifyApplicationAccessToken(token: string) {
  return verifyAccessToken(token);
}

/** Attach `req.auth` when a valid Bearer JWT is present (optional). */
export async function attachJwtAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = bearerToken(req);
    if (!token) {
      next();
      return;
    }
    const principal = await jwtPrincipalFromToken(token);
    if (principal) {
      req.auth = principal;
    }
    next();
  } catch (err) {
    next(err);
  }
}

/** Require a verified admin principal (API key or JWT with admin.access). */
export async function requireAdminAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (req.auth?.scheme === "api-key") {
    next();
    return;
  }
  if (req.auth?.scheme === "jwt" && hasPermission(req.auth.permissions, "admin.access")) {
    next();
    return;
  }
  next(new UnauthorizedError("Authentication required"));
}

/** @deprecated Use verifyApplicationAccessToken */
export const verifySupabaseAccessToken = verifyApplicationAccessToken;
