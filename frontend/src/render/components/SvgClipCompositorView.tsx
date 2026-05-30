import { memo, useId, useMemo } from "react";

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

function SvgClipCompositorViewInner({
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
  const isSolidTint = tintTop.toLowerCase() === tintBottom.toLowerCase();

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
              {isSolidTint ? (
                <stop offset="0%" stopColor={tintTop} />
              ) : (
                <>
                  <stop offset="0%" stopColor={tintTop} />
                  <stop offset="55%" stopColor={tintTop} stopOpacity={0.92} />
                  <stop offset="100%" stopColor={tintBottom} />
                </>
              )}
            </linearGradient>
            {lenses.map((lens) => (
              <clipPath key={`${uid}-clip-${lens.id}`} id={`${uid}-clip-${lens.id}`} clipPathUnits="userSpaceOnUse">
                <path d={lens.pathD} />
              </clipPath>
            ))}
          </defs>

          <image
            href={plate.plateUrl}
            x={0}
            y={0}
            width={w}
            height={h}
            preserveAspectRatio="none"
            crossOrigin="anonymous"
          />

          {lenses.map((lens) => (
            <g
              key={`${uid}-sh-${lens.id}`}
              clipPath={`url(#${uid}-clip-${lens.id})`}
              style={{ mixBlendMode: "multiply" }}
              opacity={render.shadowStrength}
            >
              <rect x={0} y={0} width={w} height={h} fill="#0f172a" />
            </g>
          ))}

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

export const SvgClipCompositorView = memo(
  SvgClipCompositorViewInner,
  (prev, next) =>
    prev.plate?.plateUrl === next.plate?.plateUrl &&
    prev.tintTop === next.tintTop &&
    prev.tintBottom === next.tintBottom &&
    prev.lensOpacity === next.lensOpacity &&
    prev.aspectRatio === next.aspectRatio &&
    prev.label === next.label &&
    prev.plate?.clipConfig === next.plate?.clipConfig,
);
