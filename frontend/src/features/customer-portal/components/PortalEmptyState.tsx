import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

interface PortalEmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  children?: ReactNode;
}

export function PortalEmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  children,
}: PortalEmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-border/50 bg-card/30 px-6 py-12 text-center">
      <h3 className="type-h3 text-foreground">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      {children}
      {actionLabel && actionHref ? (
        <Button type="button" className="mt-6" asChild>
          <Link to={actionHref}>{actionLabel}</Link>
        </Button>
      ) : null}
    </div>
  );
}
