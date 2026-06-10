import type { AuthenticatedUser, Permission, UserRole } from "@bino-foundry/shared/types";

const AUTH_SESSION_KEY = "bino-auth-session-v1";

export interface AuthUser extends AuthenticatedUser {}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
  user: AuthUser;
}

export function loadAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.accessToken || !parsed?.user?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveAuthSession(session: AuthSession): void {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

export function clearAuthSession(): void {
  localStorage.removeItem(AUTH_SESSION_KEY);
}

export function getAccessToken(): string | null {
  return loadAuthSession()?.accessToken ?? null;
}

export type { Permission, UserRole };
