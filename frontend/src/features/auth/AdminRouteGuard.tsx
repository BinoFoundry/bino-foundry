import { type ReactNode } from "react";

import { LoadingState } from "@/components/common";
import { useAuth } from "@/state/auth/AuthProvider";

import { UnavailableRedirect } from "./UnavailableRedirect";

interface AdminRouteGuardProps {
  children: ReactNode;
}

/** Secondary guard — primary redirect happens in `Index` before admin chrome renders. */
export function AdminRouteGuard({ children }: AdminRouteGuardProps) {
  const { user, isLoading, hasPermission } = useAuth();

  if (isLoading) {
    return <LoadingState label="Loading…" className="h-full" />;
  }

  if (!user || !hasPermission("admin.access")) {
    return <UnavailableRedirect to={user ? "/account" : "/bracelet"} notify={false} />;
  }

  return <>{children}</>;
}
