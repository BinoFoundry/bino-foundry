import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import type { NextFunction, Request, Response } from "express";

import { getEnv } from "../config/env.js";
import { UnauthorizedError } from "../lib/errors.js";

export type AuthPrincipal =
  | { scheme: "api-key" }
  | { scheme: "jwt"; userId: string; email?: string; isAdmin: boolean };

function bearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return undefined;
  const token = header.slice("Bearer ".length).trim();
  return token || undefined;
}

export function isAdminUser(user: User): boolean {
  const appRole = user.app_metadata?.role;
  const userRole = user.user_metadata?.role;
  return appRole === "admin" || userRole === "admin";
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
      req.auth = {
        scheme: "jwt",
        userId: user.id,
        email: user.email,
        isAdmin: isAdminUser(user),
      };
    }
    next();
  } catch (err) {
    next(err);
  }
}

/** Require a verified admin principal (API key or admin JWT). */
export async function requireAdminAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (req.auth?.scheme === "api-key") {
    next();
    return;
  }
  if (req.auth?.scheme === "jwt" && req.auth.isAdmin) {
    next();
    return;
  }
  next(new UnauthorizedError("Admin authentication required"));
}
