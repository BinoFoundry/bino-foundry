import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUTH_SESSION_CLEARED_EVENT,
  AUTH_SESSION_UPDATED_EVENT,
  clearSessionAfterAuthFailure,
  ensureFreshAccessToken,
  forceRefreshAccessToken,
} from "./access-token";
import { clearAuthSession, loadAuthSession, saveAuthSession } from "./session";

describe("access-token refresh", () => {
  beforeEach(() => {
    clearAuthSession();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearAuthSession();
  });

  it("returns the current token when it is still fresh", async () => {
    saveAuthSession({
      accessToken: "fresh-token",
      refreshToken: "refresh-token",
      expiresAt: Math.floor(Date.now() / 1000) + 600,
      user: {
        id: "u1",
        email: "admin@example.com",
        displayName: "Admin",
        emailVerified: true,
        role: "admin",
        permissions: ["catalogue.write", "admin.access"],
      },
    });

    await expect(ensureFreshAccessToken()).resolves.toBe("fresh-token");
  });

  it("refreshes proactively when the access token is near expiry", async () => {
    saveAuthSession({
      accessToken: "stale-token",
      refreshToken: "refresh-token",
      expiresAt: Math.floor(Date.now() / 1000) + 10,
      user: {
        id: "u1",
        email: "admin@example.com",
        displayName: "Admin",
        emailVerified: true,
        role: "admin",
        permissions: ["catalogue.write", "admin.access"],
      },
    });

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            user: {
              id: "u1",
              email: "admin@example.com",
              displayName: "Admin",
              emailVerified: true,
              role: "admin",
              permissions: ["catalogue.write", "admin.access"],
            },
            session: {
              accessToken: "new-token",
              refreshToken: "new-refresh",
              expiresAt: Math.floor(Date.now() / 1000) + 900,
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const updated = vi.fn();
    window.addEventListener(AUTH_SESSION_UPDATED_EVENT, updated);

    await expect(ensureFreshAccessToken()).resolves.toBe("new-token");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(loadAuthSession()?.accessToken).toBe("new-token");
    expect(updated).toHaveBeenCalled();

    window.removeEventListener(AUTH_SESSION_UPDATED_EVENT, updated);
  });

  it("force-refresh returns null and clearSessionAfterAuthFailure notifies listeners", async () => {
    saveAuthSession({
      accessToken: "expired",
      refreshToken: "bad-refresh",
      expiresAt: Math.floor(Date.now() / 1000) - 10,
      user: {
        id: "u1",
        email: "admin@example.com",
        displayName: "Admin",
        emailVerified: true,
        role: "admin",
        permissions: ["catalogue.write", "admin.access"],
      },
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 401 }));

    await expect(forceRefreshAccessToken()).resolves.toBeNull();

    const cleared = vi.fn();
    window.addEventListener(AUTH_SESSION_CLEARED_EVENT, cleared);
    clearSessionAfterAuthFailure();
    expect(loadAuthSession()).toBeNull();
    expect(cleared).toHaveBeenCalled();
    window.removeEventListener(AUTH_SESSION_CLEARED_EVENT, cleared);
  });
});
