import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import type { Permission, UserRole } from "@bino-foundry/shared/types";
import { postAuthLandingPath } from "@/lib/auth-landing";
import { checkPermission } from "@/lib/permissions";
import { authApi } from "@/services/api/auth";
import { designsApi } from "@/services/api/designs";
import { isApiError } from "@/services/api/errors";
import {
  clearAuthSession,
  loadAuthSession,
  saveAuthSession,
  type AuthSession,
  type AuthUser,
} from "@/services/auth/session";
import type { SaveDesignRequest, SavedDesignSummary } from "@bino-foundry/shared/types";

import {
  clearPendingDesign,
  loadPendingDesign,
  notifyPendingDesignComplete,
  storePendingDesign,
  type PendingDesignSave,
} from "@/features/designs/pending-design";

interface AuthContextValue {
  user: AuthUser | null;
  role: UserRole | null;
  permissions: Permission[];
  session: AuthSession | null;
  isLoading: boolean;
  authModalOpen: boolean;
  authModalMode: "sign-in" | "sign-up";
  hasPermission: (permission: Permission) => boolean;
  refreshUser: () => Promise<void>;
  openAuth: (options?: { mode?: "sign-in" | "sign-up"; pendingSave?: PendingDesignSave }) => void;
  closeAuth: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ needsEmailVerification: boolean }>;
  signOut: () => Promise<void>;
  saveDesign: (request: SaveDesignRequest, options?: { designId?: string }) => Promise<SavedDesignSummary | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function sessionFromLoginResponse(
  user: AuthUser,
  tokens: { accessToken: string; refreshToken: string; expiresAt: number | null },
): AuthSession {
  return {
    user,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState<AuthSession | null>(() => loadAuthSession());
  const [isLoading, setIsLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"sign-in" | "sign-up">("sign-in");

  const user = session?.user ?? null;
  const role = user?.role ?? null;
  const permissions = user?.permissions ?? [];

  const hasPermission = useCallback(
    (permission: Permission) => checkPermission(permissions, permission),
    [permissions],
  );

  const flushPendingSave = useCallback(async (activeSession: AuthSession) => {
    const pending = loadPendingDesign();
    if (!pending) return null;
    try {
      const saved = await designsApi.save({ ...pending.request, designId: pending.designId });
      clearPendingDesign();
      notifyPendingDesignComplete(saved);
      toast.success("Your design was saved to your account.");
      return saved;
    } catch (err) {
      notifyPendingDesignComplete(null);
      toast.error(isApiError(err) ? err.message : "Could not save your design after sign-in.");
      return null;
    } finally {
      void activeSession;
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const stored = loadAuthSession();
    if (!stored) return;

    const now = Math.floor(Date.now() / 1000);
    const expiresSoon =
      stored.expiresAt != null && stored.expiresAt - now < 60;

    if (expiresSoon && stored.refreshToken) {
      try {
        const refreshed = await authApi.refresh(stored.refreshToken);
        if (refreshed.session) {
          const next = sessionFromLoginResponse(refreshed.user, refreshed.session);
          saveAuthSession(next);
          setSession(next);
          return;
        }
      } catch {
        /* fall through to /me */
      }
    }

    const me = await authApi.me();
    if (!me.authenticated || !me.user) {
      clearAuthSession();
      setSession(null);
      return;
    }
    const next: AuthSession = { ...stored, user: me.user };
    saveAuthSession(next);
    setSession(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = loadAuthSession();
      if (!stored) {
        if (!cancelled) setIsLoading(false);
        return;
      }
      try {
        await refreshUser();
        if (!cancelled) {
          const latest = loadAuthSession();
          if (latest) await flushPendingSave(latest);
        }
      } catch {
        if (!cancelled) {
          clearAuthSession();
          setSession(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [flushPendingSave, refreshUser]);

  const openAuth = useCallback(
    (options?: { mode?: "sign-in" | "sign-up"; pendingSave?: PendingDesignSave }) => {
      if (options?.pendingSave) {
        storePendingDesign(options.pendingSave);
      }
      setAuthModalMode(options?.mode ?? "sign-in");
      setAuthModalOpen(true);
    },
    [],
  );

  const closeAuth = useCallback(() => {
    setAuthModalOpen(false);
  }, []);

  const completeAuth = useCallback(
    async (response: Awaited<ReturnType<typeof authApi.login>>) => {
      if (!response.session) {
        toast.message("Check your email to confirm your account, then sign in.");
        setAuthModalMode("sign-in");
        return;
      }
      const next = sessionFromLoginResponse(response.user, response.session);
      saveAuthSession(next);
      setSession(next);
      setAuthModalOpen(false);
      toast.success("Welcome back.");
      await flushPendingSave(next);
      navigate(postAuthLandingPath(response.user));
    },
    [flushPendingSave, navigate],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const response = await authApi.login({ email, password });
      await completeAuth(response);
    },
    [completeAuth],
  );

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      const response = await authApi.register({ email, password, displayName: displayName.trim() });
      if (!response.session) {
        if (response.emailSent === false && response.emailWarning) {
          toast.error(response.emailWarning);
        } else {
          toast.message("Account created. Check your email to confirm, then sign in.");
        }
        setAuthModalMode("sign-in");
        return { needsEmailVerification: true };
      }
      await completeAuth(response);
      return { needsEmailVerification: false };
    },
    [completeAuth],
  );

  const signOut = useCallback(async () => {
    const stored = loadAuthSession();
    const wasOnAccount = location.pathname.startsWith("/account");
    try {
      await authApi.logout(stored?.refreshToken);
    } catch {
      /* ignore */
    }
    clearAuthSession();
    setSession(null);
    toast.message("Signed out.");
    if (wasOnAccount) {
      navigate("/bracelet", { replace: true });
    }
  }, [location.pathname, navigate]);

  const saveDesign = useCallback(
    async (request: SaveDesignRequest, options?: { designId?: string }) => {
      if (!session) {
        openAuth({ mode: "sign-in", pendingSave: { request, designId: options?.designId } });
        return null;
      }
      try {
        const saved = await designsApi.save({ ...request, designId: options?.designId });
        toast.success("Design saved to your account.");
        return saved;
      } catch (err) {
        if (isApiError(err) && err.status === 401) {
          openAuth({ mode: "sign-in", pendingSave: { request, designId: options?.designId } });
          return null;
        }
        toast.error(isApiError(err) ? err.message : "Could not save your design.");
        throw err;
      }
    },
    [openAuth, session],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role,
      permissions,
      session,
      isLoading,
      authModalOpen,
      authModalMode,
      hasPermission,
      refreshUser,
      openAuth,
      closeAuth,
      signIn,
      signUp,
      signOut,
      saveDesign,
    }),
    [
      user,
      role,
      permissions,
      session,
      isLoading,
      authModalOpen,
      authModalMode,
      hasPermission,
      refreshUser,
      openAuth,
      closeAuth,
      signIn,
      signUp,
      signOut,
      saveDesign,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
