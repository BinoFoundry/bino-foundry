import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppShell } from "@/layouts";
import { authApi } from "@/services/api/auth";
import { isApiError } from "@/services/api/errors";
import { saveAuthSession } from "@/services/auth/session";

function parseHashTokens(): {
  accessToken: string | null;
  refreshToken: string | null;
  type: string | null;
} {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(hash);
  return {
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
    type: params.get("type"),
  };
}

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const tokens = useMemo(() => parseHashTokens(), []);
  const [mode, setMode] = useState<"loading" | "reset" | "verified" | "error">("loading");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!tokens.accessToken) {
      setMode("error");
      setError("This link is invalid or has expired.");
      return;
    }

    if (tokens.type === "recovery") {
      setMode("reset");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await authApi.confirmEmail({
          accessToken: tokens.accessToken!,
          refreshToken: tokens.refreshToken ?? undefined,
        });
        if (cancelled) return;
        if (response.session) {
          saveAuthSession({
            accessToken: response.session.accessToken,
            refreshToken: response.session.refreshToken,
            expiresAt: response.session.expiresAt,
            user: response.user,
          });
        }
        setMode("verified");
        toast.success(response.message ?? "Email verified.");
      } catch (err) {
        if (!cancelled) {
          setMode("error");
          setError(isApiError(err) ? err.message : "Could not verify email.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tokens.accessToken, tokens.refreshToken, tokens.type]);

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tokens.accessToken) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await authApi.resetPassword({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? undefined,
        password,
      });
      if (response.session) {
        saveAuthSession({
          accessToken: response.session.accessToken,
          refreshToken: response.session.refreshToken,
          expiresAt: response.session.expiresAt,
          user: response.user,
        });
      }
      toast.success(response.message ?? "Password updated.");
      navigate("/account");
    } catch (err) {
      setError(isApiError(err) ? err.message : "Could not reset password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell activeModule="bracelet">
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-16 text-center">
        {mode === "loading" ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Confirming your account…</p>
          </>
        ) : null}

        {mode === "verified" ? (
          <>
            <h1 className="type-h2">Email verified</h1>
            <p className="text-sm text-muted-foreground">Your account is ready. Continue designing or view saved work.</p>
            <div className="flex gap-2">
              <Button type="button" asChild>
                <Link to="/account">My account</Link>
              </Button>
              <Button type="button" variant="secondary" asChild>
                <Link to="/bracelet">Bracelet builder</Link>
              </Button>
            </div>
          </>
        ) : null}

        {mode === "reset" ? (
          <>
            <h1 className="type-h2">Set a new password</h1>
            <form className="w-full space-y-4 text-left" onSubmit={(e) => void handleResetPassword(e)}>
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Updating…" : "Update password"}
              </Button>
            </form>
          </>
        ) : null}

        {mode === "error" ? (
          <>
            <h1 className="type-h2">Link unavailable</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button type="button" variant="secondary" asChild>
              <Link to="/bracelet">Back to builder</Link>
            </Button>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
