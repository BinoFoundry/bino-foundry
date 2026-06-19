import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { REGISTRATION_NAME_LABEL } from "@bino-foundry/shared/constants";
import { getCustomerNameValidationError } from "@/lib/customer-name";
import { authApi } from "@/services/api/auth";
import { isApiError } from "@/services/api/errors";
import { useAuth } from "@/state/auth/AuthProvider";

type AuthView = "sign-in" | "sign-up" | "forgot-password";

function isUnverifiedLoginError(message: string): boolean {
  return message.toLowerCase().includes("verify your email");
}

export function AuthModal() {
  const { authModalOpen, authModalMode, closeAuth, signIn, signUp, user } = useAuth();
  const [view, setView] = useState<AuthView>(authModalMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [displayNameError, setDisplayNameError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [resending, setResending] = useState(false);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);

  useEffect(() => {
    if (authModalOpen) {
      setView(authModalMode);
      setError("");
      setDisplayNameError("");
      setInfo("");
      setNeedsEmailVerification(false);
    }
  }, [authModalOpen, authModalMode]);

  const handleOpenChange = (open: boolean) => {
    if (!open) closeAuth();
  };

  const showVerificationNotice =
    view === "sign-in" && needsEmailVerification && !user?.emailVerified;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setInfo("");
    try {
      if (view === "forgot-password") {
        const response = await authApi.forgotPassword({
          email: email.trim(),
          redirectTo: `${window.location.origin}/auth/callback`,
        });
        setInfo(response.message);
        toast.message(response.message);
        return;
      }
      if (view === "sign-in") {
        await signIn(email.trim(), password);
      } else {
        const nameError = getCustomerNameValidationError(displayName);
        if (nameError) {
          setDisplayNameError(nameError);
          return;
        }
        const result = await signUp(email.trim(), password, displayName.trim());
        if (result.needsEmailVerification) {
          setNeedsEmailVerification(true);
          setView("sign-in");
        }
      }
    } catch (err) {
      const message = isApiError(err) ? err.message : "Authentication failed";
      setError(message);
      if (view === "sign-in" && isUnverifiedLoginError(message)) {
        setNeedsEmailVerification(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    setResending(true);
    setError("");
    setInfo("");
    try {
      const response = await authApi.resendVerification(email.trim());
      if (response.emailSent === false) {
        setError(response.message);
        toast.error(response.message);
      } else {
        setInfo(response.message);
        toast.message(response.message);
      }
    } catch (err) {
      const message = isApiError(err) ? err.message : "Could not resend verification email";
      setError(message);
    } finally {
      setResending(false);
    }
  };

  return (
    <Dialog open={authModalOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {view === "forgot-password" ? "Reset your password" : "Save your design"}
          </DialogTitle>
          <DialogDescription>
            {view === "forgot-password"
              ? "We'll email you a secure link to choose a new password."
              : "Sign in or create an account to save your work and continue later from any device."}
          </DialogDescription>
        </DialogHeader>

        {view === "forgot-password" ? (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="auth-email">Email</Label>
              <Input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {info ? <p className="text-sm text-muted-foreground">{info}</p> : null}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Sending…" : "Send reset link"}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setView("sign-in")}>
              Back to sign in
            </Button>
          </form>
        ) : (
          <Tabs
            value={view}
            onValueChange={(value) => setView(value as AuthView)}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="sign-in">Sign in</TabsTrigger>
              <TabsTrigger value="sign-up">Register</TabsTrigger>
            </TabsList>

            <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
              {showVerificationNotice ? (
                <div
                  className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm"
                  role="status"
                >
                  <p className="font-medium text-foreground">Your email address has not been verified.</p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="mt-3 w-full"
                    disabled={resending || !email.trim()}
                    onClick={() => void handleResendVerification()}
                  >
                    {resending ? "Sending…" : "Resend verification email"}
                  </Button>
                </div>
              ) : null}

              {view === "sign-up" ? (
                <div className="space-y-2">
                  <Label htmlFor="auth-name">
                    {REGISTRATION_NAME_LABEL} <span className="text-destructive" aria-hidden="true">*</span>
                  </Label>
                  <Input
                    id="auth-name"
                    required
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value);
                      if (displayNameError) setDisplayNameError("");
                    }}
                    autoComplete="name"
                  />
                  {displayNameError ? (
                    <p className="text-sm text-destructive">{displayNameError}</p>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="auth-email">Email</Label>
                <Input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="auth-password">Password</Label>
                  {view === "sign-in" ? (
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => setView("forgot-password")}
                    >
                      Forgot password?
                    </button>
                  ) : null}
                </div>
                <Input
                  id="auth-password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={view === "sign-in" ? "current-password" : "new-password"}
                />
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              {info ? <p className="text-sm text-muted-foreground">{info}</p> : null}

              <TabsContent value="sign-in" className="mt-0">
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Signing in…" : "Sign in & save"}
                </Button>
              </TabsContent>
              <TabsContent value="sign-up" className="mt-0">
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Creating account…" : "Create account & save"}
                </Button>
              </TabsContent>
            </form>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
