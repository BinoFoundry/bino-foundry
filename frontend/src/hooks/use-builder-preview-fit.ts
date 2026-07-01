import { useMemo, type CSSProperties } from "react";

import {
  BUILDER_PREVIEW_FIT_CSS_VAR,
  formatPreviewFitCss,
  previewFitPercentForTier,
  type BuilderPreviewFitKey,
  type PreviewFitTier,
} from "@/config/builder-preview-settings";

import { useBreakpoint, type Breakpoint } from "./use-breakpoint";

export function previewFitTierFromBreakpoint(breakpoint: Breakpoint): PreviewFitTier {
  switch (breakpoint) {
    case "2xl":
      return "desktop";
    case "xl":
      return "largeLaptop";
    case "lg":
      return "laptop";
    case "md":
      return "tablet";
    default:
      return "mobile";
  }
}

/** Responsive preview fit percentage for a builder (layout only). */
export function useBuilderPreviewFit(builder: BuilderPreviewFitKey): string {
  const breakpoint = useBreakpoint();
  return useMemo(() => {
    const tier = previewFitTierFromBreakpoint(breakpoint);
    return formatPreviewFitCss(previewFitPercentForTier(builder, tier));
  }, [builder, breakpoint]);
}

export function builderPreviewFitStyle(fit: string): CSSProperties {
  return { [BUILDER_PREVIEW_FIT_CSS_VAR]: fit };
}
