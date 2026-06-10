import { type ReactNode } from "react";

import { LoadingState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/state/auth/AuthProvider";

interface RequireCustomerAuthProps {
  children: ReactNode;
}

export function RequireCustomerAuth({ children }: RequireCustomerAuthProps) {
  const { user, isLoading, openAuth } = useAuth();

  if (isLoading) {
    return <LoadingState label="Loading your account…" className="min-h-[50vh]" />;
  }

  if (!user) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="type-h2">Your portal</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Sign in to view saved designs, track orders, and manage your account.
        </p>
        <Button type="button" onClick={() => openAuth({ mode: "sign-in" })}>
          Sign in
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
