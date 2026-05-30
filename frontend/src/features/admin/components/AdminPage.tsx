import type { ReactNode } from "react";

interface AdminPageProps {
  children: ReactNode;
  footer?: ReactNode;
}

/** Scrollable main content area for an admin section. */
export function AdminPage({ children, footer }: AdminPageProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="admin-scroll-pane p-4 sm:p-6">{children}</div>
      {footer ? (
        <footer className="shrink-0 border-t border-border px-4 py-3 text-xs text-muted-foreground sm:px-6">
          {footer}
        </footer>
      ) : null}
    </div>
  );
}
