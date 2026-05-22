import { useId, useMemo } from "react";

import { cn } from "@/lib/utils";
import { resolveLensClipRenderSettings } from "@/render/lens-clip/clip-settings";
import type { LensClipConfig } from "@bino-foundry/shared/types";
import type { CompositorView } from "../types";
import { CompositorViewport, type CompositorAspectRatio } from "./CompositorViewport";

export interface SvgClipPlateInput {
  plateUrl: string;
  width: number;
  height: number;
  clipConfig: LensClipConfig;
}

export interface SvgClipCompositorViewProps {
  view: CompositorView;
  plate: SvgClipPlateInput | null;
  tintTop: string;
  tintBottom: string;
  lensOpacity?: number;
  aspectRatio?: CompositorAspectRatio;
  label?: string;
  className?: string;
}

/**
 * Sunglasses tint via SVG clipPath + gradient layers (no canvas mask bitmap).
 * Preserves plate highlights using a screened copy of the photo inside each clip.
 */
export function SvgClipCompositorView({
  plate,
  tintTop,
  tintBottom,
  lensOpacity: lensOpacityProp,
  aspectRatio = "16/10",
  label,
  className,
}: SvgClipCompositorViewProps) {
  const uid = useId().replace(/:/g, "");
  const render = useMemo(
    () => resolveLensClipRenderSettings(plate?.clipConfig, { lensOpacity: lensOpacityProp }),
    [plate?.clipConfig, lensOpacityProp],
  );

  if (!plate?.plateUrl || !plate.clipConfig?.lenses?.length) {
    return (
      <CompositorViewport aspectRatio={aspectRatio} label={label} className={className}>
        <p className="text-sm text-muted-foreground">No clip paths configured for this view</p>
      </CompositorViewport>
    );
  }

  const { width: w, height: h } = plate;
  const tintId = `${uid}-tint`;
  const lenses = plate.clipConfig.lenses.filter((l) => l.pathD?.trim());

  return (
    <CompositorViewport aspectRatio={aspectRatio} label={label} className={className}>
      <div className={cn("flex h-full w-full items-center justify-center bg-muted/15")}>
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="max-h-full max-w-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={label ?? "Sunglasses preview"}
        >
          <defs>
            <linearGradient id={tintId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={tintTop} />
              <stop offset="100%" stopColor={tintBottom} />
            </linearGradient>
            {lenses.map((lens) => (
              <clipPath key={`${uid}-clip-${lens.id}`} id={`${uid}-clip-${lens.id}`} clipPathUnits="userSpaceOnUse">
                <path d={lens.pathD} />
              </clipPath>
            ))}
          </defs>

          {/* Full frame plate (shadows + frame structure) */}
          <image
            href={plate.plateUrl}
            x={0}
            y={0}
            width={w}
            height={h}
            preserveAspectRatio="none"
            crossOrigin="anonymous"
          />

          {/* Dynamic lens tint inside each clip */}
          {lenses.map((lens) => (
            <g
              key={`${uid}-tint-${lens.id}`}
              clipPath={`url(#${uid}-clip-${lens.id})`}
              style={{ mixBlendMode: render.tintBlendMode }}
              opacity={render.lensOpacity}
            >
              <rect x={0} y={0} width={w} height={h} fill={`url(#${tintId})`} />
            </g>
          ))}

          {/* Lens-region highlights from original plate */}
          {lenses.map((lens) => (
            <g
              key={`${uid}-hi-${lens.id}`}
              clipPath={`url(#${uid}-clip-${lens.id})`}
              style={{ mixBlendMode: render.highlightBlendMode }}
              opacity={render.highlightStrength}
            >
              <image
                href={plate.plateUrl}
                x={0}
                y={0}
                width={w}
                height={h}
                preserveAspectRatio="none"
                crossOrigin="anonymous"
              />
            </g>
          ))}
        </svg>
      </div>
    </CompositorViewport>
  );
}
