import type { ReactNode } from "react";

import type { BuilderPreviewFitKey } from "@/config/builder-preview-settings";
import {
  builderPreviewFitStyle,
  useBuilderPreviewFit,
} from "@/hooks/use-builder-preview-fit";
import { cn } from "@/lib/utils";

interface BuilderPreviewFitScopeProps {
  builder: BuilderPreviewFitKey;
  className?: string;
  children: ReactNode;
}

/**
 * Sets `--builder-preview-fit` for descendants. Does not touch renderers, viewBoxes, or assets.
 */
export function BuilderPreviewFitScope({
  builder,
  className,
  children,
}: BuilderPreviewFitScopeProps) {
  const fit = useBuilderPreviewFit(builder);

  return (
    <div
      className={cn("builder-preview-fit", className)}
      style={builderPreviewFitStyle(fit)}
    >
      {children}
    </div>
  );
}
