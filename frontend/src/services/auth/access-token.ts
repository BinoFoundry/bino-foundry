import { resolveApiUrl } from "@/config/env";

import {
  clearAuthSession,
  loadAuthSession,
  saveAuthSession,
  type AuthSession,
} from "./session";

/** Refresh when fewer than this many seconds remain on the access token. */
const REFRESH_SKEW_SECONDS = 60;

export const AUTH_SESSION_CLEARED_EVENT = "bino-auth-session-cleared";
export const AUTH_SESSION_UPDATED_EVENT = "bino-auth-session-updated";

let refreshInFlight: Promise<string | null> | null = null;

function accessTokenNeedsRefresh(session: AuthSession, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  if (session.expiresAt == null) return false;
  return session.expiresAt - nowSeconds < REFRESH_SKEW_SECONDS;
}

function accessTokenExpired(session: AuthSession, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  return session.expiresAt != null && session.expiresAt <= nowSeconds;
}

function notifySessionUpdated(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_SESSION_UPDATED_EVENT));
  }
}

/**
 * Exchange the refresh token for a new access token.
 * Uses a bare fetch (not apiRequest) to avoid circular imports and Authorization loops.
 */
async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch(resolveApiUrl("/auth/refresh"), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    return null;
  }

  const payload = (await res.json()) as {
    data?: {
      user?: AuthSession["user"];
      session?: {
        accessToken: string;
        refreshToken: string;
        expiresAt: number | null;
      };
    };
  };

  const nextSession = payload.data?.session;
  const nextUser = payload.data?.user ?? loadAuthSession()?.user;
  if (!nextSession?.accessToken || !nextUser?.id) {
    return null;
  }

  const session: AuthSession = {
    user: nextUser,
    accessToken: nextSession.accessToken,
    refreshToken: nextSession.refreshToken,
    expiresAt: nextSession.expiresAt,
  };
  saveAuthSession(session);
  notifySessionUpdated();
  return session.accessToken;
}

/**
 * Return a usable access token, refreshing proactively when near expiry.
 * Concurrent callers share a single in-flight refresh.
 */
export async function ensureFreshAccessToken(): Promise<string | null> {
  const session = loadAuthSession();
  if (!session?.accessToken) return null;

  if (!accessTokenNeedsRefresh(session)) {
    return session.accessToken;
  }

  if (!session.refreshToken) {
    return session.accessToken;
  }

  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken(session.refreshToken)
      .then((token) => {
        if (token) return token;
        // Refresh failed — only return the old token if it is still within its lifetime.
        return accessTokenExpired(session) ? null : session.accessToken;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
}

/**
 * Force a refresh after a 401 (token may already be expired).
 * Returns the new access token, or null when the session cannot be renewed.
 */
export async function forceRefreshAccessToken(): Promise<string | null> {
  const session = loadAuthSession();
  if (!session?.refreshToken) return null;

  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken(session.refreshToken).finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

/** Clear local session after an unrecoverable auth failure. */
export function clearSessionAfterAuthFailure(): void {
  clearAuthSession();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_SESSION_CLEARED_EVENT));
  }
}
