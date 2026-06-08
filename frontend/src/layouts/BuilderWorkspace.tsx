import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface BuilderWorkspaceProps {
  leftPanel?: ReactNode;
  centerPanel: ReactNode;
  rightPanel?: ReactNode;
  /** Mobile-only panels rendered below the canvas (e.g. collapsible summary). */
  mobileFooter?: ReactNode;
  className?: string;
}

function BuilderSidePanel({
  children,
  side,
}: {
  children: ReactNode;
  side: "left" | "right";
}) {
  return (
    <aside
      className={cn(
        "hidden h-full min-h-0 w-[min(340px,30vw)] min-w-[280px] shrink-0 flex-col bg-background lg:flex",
        side === "left" ? "border-r border-border" : "border-l border-border",
      )}
    >
      <div
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        data-scroll-isolate="true"
        onWheel={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </aside>
  );
}

/** Three-column builder shell: configuration · preview · summary. */
export function BuilderWorkspace({
  leftPanel,
  centerPanel,
  rightPanel,
  mobileFooter,
  className,
}: BuilderWorkspaceProps) {
  return (
    <div className={cn("flex h-full min-h-0 w-full flex-1 flex-col", className)}>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {leftPanel ? <BuilderSidePanel side="left">{leftPanel}</BuilderSidePanel> : null}

        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {centerPanel}
        </section>

        {rightPanel ? <BuilderSidePanel side="right">{rightPanel}</BuilderSidePanel> : null}
      </div>

      {mobileFooter ? <div className="shrink-0 lg:hidden">{mobileFooter}</div> : null}
    </div>
  );
}
