import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SunglassesBuilderLayoutProps {
  preview: ReactNode;
  configuration: ReactNode;
  /** Mobile / tablet: step navigation rendered above preview. */
  mobileSteps?: ReactNode;
  className?: string;
}

/**
 * Sunglasses-specific 2-column workspace.
 * Desktop: ~62% preview left · ~38% configuration right.
 * Tablet: preview top · configuration bottom.
 * Mobile: steps · preview · configuration (stacked).
 */
export function SunglassesBuilderLayout({
  preview,
  configuration,
  mobileSteps,
  className,
}: SunglassesBuilderLayoutProps) {
  return (
    <div className={cn("flex h-full min-h-0 w-full flex-col", className)}>
      {mobileSteps ? (
        <div className="shrink-0 border-b border-border px-4 py-3 lg:hidden">{mobileSteps}</div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden lg:grid-cols-[minmax(0,62fr)_minmax(0,38fr)] lg:grid-rows-1">
        <section className="surface-canvas relative flex max-h-[min(42vh,26rem)] shrink-0 flex-col overflow-hidden lg:max-h-none lg:min-h-0">
          {preview}
        </section>

        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden">{configuration}</section>
      </div>
    </div>
  );
}
