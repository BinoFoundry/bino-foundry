import jwt from "jsonwebtoken";
import type { UserRole } from "@bino-foundry/shared/types";

import { getEnv } from "../config/env.js";

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  type: "access";
}

function jwtSecret(): string {
  const configured = getEnv().JWT_SECRET?.trim();
  if (configured) return configured;
  if (getEnv().APP_ENV === "development" || getEnv().APP_ENV === "test") {
    return "dev-only-insecure-jwt-secret-change-me-before-production";
  }
  throw new Error("JWT_SECRET is not configured");
}

export function signAccessToken(userId: string, role: UserRole): { token: string; expiresAt: number } {
  const ttlSeconds = getEnv().JWT_ACCESS_TTL_SECONDS;
  const token = jwt.sign({ sub: userId, role, type: "access" satisfies AccessTokenPayload["type"] }, jwtSecret(), {
    expiresIn: ttlSeconds,
  });
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  return { token, expiresAt };
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, jwtSecret()) as jwt.JwtPayload;
    if (decoded.type !== "access" || typeof decoded.sub !== "string" || typeof decoded.role !== "string") {
      return null;
    }

    return {
      sub: decoded.sub,
      role: decoded.role as UserRole,
      type: "access",
    };
  } catch {
    return null;
  }
}
