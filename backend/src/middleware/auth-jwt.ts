import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import type { NextFunction, Request, Response } from "express";
import type { Permission, UserRole } from "@bino-foundry/shared/types";

import { getEnv } from "../config/env.js";
import { UnauthorizedError } from "../lib/errors.js";
import { buildAuthUser, hasPermission, isAdminRole } from "../lib/rbac.js";

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

/** @deprecated Prefer role + permissions from buildAuthUser */
export function isAdminUser(user: User): boolean {
  const authUser = buildAuthUser(user);
  return isAdminRole(authUser.role);
}

function jwtPrincipal(user: User, profileRole?: string | null): Extract<AuthPrincipal, { scheme: "jwt" }> {
  const authUser = buildAuthUser(user, profileRole);
  return {
    scheme: "jwt",
    userId: authUser.id,
    email: authUser.email ?? undefined,
    role: authUser.role,
    permissions: authUser.permissions,
    isAdmin: isAdminRole(authUser.role),
  };
}

/** Verify Supabase access token via Auth API (anon key). Returns null if auth is not configured. */
export async function verifySupabaseAccessToken(token: string): Promise<User | null> {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = getEnv();
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

/** Attach `req.auth` when a valid Bearer JWT is present (optional). */
export async function attachJwtAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = bearerToken(req);
    if (!token) {
      next();
      return;
    }
    const user = await verifySupabaseAccessToken(token);
    if (user) {
      req.auth = jwtPrincipal(user);
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
