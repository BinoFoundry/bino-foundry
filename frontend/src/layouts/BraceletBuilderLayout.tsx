import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface BraceletBuilderLayoutProps {
  leftPanel?: ReactNode;
  centerPanel: ReactNode;
  rightPanel?: ReactNode;
  mobileFooter?: ReactNode;
  className?: string;
}

/**
 * Bracelet-specific 3-column workspace.
 * Left ~260–280px · center flex · right ~300–320px so the canvas dominates.
 */
export function BraceletBuilderLayout({
  leftPanel,
  centerPanel,
  rightPanel,
  mobileFooter,
  className,
}: BraceletBuilderLayoutProps) {
  return (
    <div className={cn("flex h-full min-h-0 w-full flex-1 flex-col", className)}>
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(260px,280px)_minmax(0,1fr)_minmax(300px,320px)]">
        {leftPanel ? (
          <aside className="hidden h-full min-h-0 flex-col border-r border-border bg-background lg:flex">
            <div
              className="flex min-h-0 flex-1 flex-col overflow-y-auto"
              data-scroll-isolate="true"
              onWheel={(e) => e.stopPropagation()}
            >
              {leftPanel}
            </div>
          </aside>
        ) : null}

        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden">{centerPanel}</section>

        {rightPanel ? (
          <aside className="hidden h-full min-h-0 flex-col border-l border-border bg-background lg:flex">
            <div
              className="flex min-h-0 flex-1 flex-col overflow-y-auto"
              data-scroll-isolate="true"
              onWheel={(e) => e.stopPropagation()}
            >
              {rightPanel}
            </div>
          </aside>
        ) : null}
      </div>

      {mobileFooter ? <div className="shrink-0 lg:hidden">{mobileFooter}</div> : null}
    </div>
  );
}
