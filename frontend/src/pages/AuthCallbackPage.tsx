import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppShell } from "@/layouts";
import { postAuthLandingPath } from "@/lib/auth-landing";
import { authApi } from "@/services/api/auth";
import { isApiError } from "@/services/api/errors";
import { saveAuthSession } from "@/services/auth/session";

const VERIFICATION_REDIRECT_MS = 2500;

function parseCallbackParams(searchParams: URLSearchParams): {
  token: string | null;
  type: string | null;
} {
  return {
    token: searchParams.get("token"),
    type: searchParams.get("type"),
  };
}

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tokens = useMemo(() => parseCallbackParams(searchParams), [searchParams]);
  const [mode, setMode] = useState<"loading" | "reset" | "verified" | "error">("loading");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [verifiedUser, setVerifiedUser] = useState<Awaited<ReturnType<typeof authApi.confirmEmail>>["user"]>(null);

  useEffect(() => {
    if (!tokens.token) {
      setMode("error");
      setError("This link is invalid or has expired.");
      return;
    }

    if (tokens.type === "reset-password") {
      setMode("reset");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await authApi.confirmEmail({ token: tokens.token! });
        if (cancelled) return;
        if (response.session) {
          saveAuthSession({
            accessToken: response.session.accessToken,
            refreshToken: response.session.refreshToken,
            expiresAt: response.session.expiresAt,
            user: response.user,
          });
        }
        setVerifiedUser(response.user);
        setMode("verified");
        toast.success("Your email has been verified successfully.");
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
  }, [tokens.token, tokens.type]);

  useEffect(() => {
    if (mode !== "verified" || !verifiedUser) return;

    const destination = postAuthLandingPath(verifiedUser);
    const timer = window.setTimeout(() => {
      navigate(destination, { replace: true, state: { emailVerified: true } });
    }, VERIFICATION_REDIRECT_MS);

    return () => window.clearTimeout(timer);
  }, [mode, navigate, verifiedUser]);

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tokens.token) return;

    setPasswordError("");
    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const response = await authApi.resetPassword({
        token: tokens.token,
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
      navigate(response.user ? postAuthLandingPath(response.user) : "/account");
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
            <CheckCircle2 className="h-10 w-10 text-success" aria-hidden />
            <h1 className="type-h2">Email verified</h1>
            <p className="text-sm text-muted-foreground">
              Your email has been verified successfully. Taking you to your dashboard…
            </p>
            <Button type="button" asChild variant="secondary" size="sm">
              <Link to={verifiedUser ? postAuthLandingPath(verifiedUser) : "/account"}>
                Go to dashboard now
              </Link>
            </Button>
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
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError("");
                  }}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm your new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  minLength={8}
                  required
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (passwordError) setPasswordError("");
                  }}
                  autoComplete="new-password"
                />
              </div>
              {passwordError ? <p className="text-sm text-destructive">{passwordError}</p> : null}
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
