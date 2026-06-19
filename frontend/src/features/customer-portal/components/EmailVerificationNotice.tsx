import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { authApi } from "@/services/api/auth";
import { isApiError } from "@/services/api/errors";
import { useAuth } from "@/state/auth/AuthProvider";

export function EmailVerificationNotice() {
  const { user } = useAuth();
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user || user.emailVerified) {
    return null;
  }

  const email = user.email?.trim() ?? "";

  return (
    <div
      className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm"
      role="status"
    >
      <p className="font-medium text-foreground">Your email address has not been verified.</p>
      <p className="mt-1 text-muted-foreground">
        Check your inbox for the verification link, or request a new one below.
      </p>
      {message ? <p className="mt-2 text-muted-foreground">{message}</p> : null}
      {error ? <p className="mt-2 text-destructive">{error}</p> : null}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-3"
        disabled={resending || !email}
        onClick={async () => {
          if (!email) return;
          setResending(true);
          setError(null);
          setMessage(null);
          try {
            const response = await authApi.resendVerification(email);
            if (response.emailSent === false) {
              setError(response.message);
              toast.error(response.message);
            } else {
              setMessage(response.message);
              toast.message(response.message);
            }
          } catch (err) {
            const msg = isApiError(err) ? err.message : "Could not resend verification email";
            setError(msg);
          } finally {
            setResending(false);
          }
        }}
      >
        {resending ? "Sending…" : "Resend verification email"}
      </Button>
    </div>
  );
}
