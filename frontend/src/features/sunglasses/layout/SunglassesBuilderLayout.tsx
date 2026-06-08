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

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,62fr)_minmax(0,38fr)]">
        <section className="surface-canvas relative flex min-h-[min(50vh,28rem)] flex-col overflow-hidden lg:min-h-0">
          {preview}
        </section>

        <section className="flex min-h-0 flex-col lg:max-h-full">{configuration}</section>
      </div>
    </div>
  );
}
