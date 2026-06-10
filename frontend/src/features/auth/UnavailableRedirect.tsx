import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";

import { CUSTOMER_COPY } from "@/lib/customer-copy";

interface UnavailableRedirectProps {
  to: string;
  /** When true, show a generic unavailable toast once before redirecting. */
  notify?: boolean;
}

/**
 * Quietly sends users away from routes they cannot use — without revealing
 * protected areas, roles, or permissions.
 */
export function UnavailableRedirect({ to, notify = true }: UnavailableRedirectProps) {
  useEffect(() => {
    if (!notify) return;
    toast.message(CUSTOMER_COPY.pageUnavailable);
  }, [notify]);

  return <Navigate to={to} replace />;
}
