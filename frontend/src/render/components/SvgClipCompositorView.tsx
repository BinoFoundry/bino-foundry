import { memo, useId, useMemo } from "react";

import { cn } from "@/lib/utils";
import { resolveLensClipRenderSettings } from "@/render/lens-clip/clip-settings";
import { SvgTintGradientDef } from "@/render/tint/SvgTintGradientDef";
import {
  normalizeTintRenderSpec,
  resolveHighlightStrength,
  type NormalizedTintRenderSpec,
} from "@/render/tint/lens-tint-spec";
import type { LensClipConfig } from "@bino-foundry/shared/types";
import type { CompositorView, TintGradient } from "../types";
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
  tint: TintGradient;
  aspectRatio?: CompositorAspectRatio;
  label?: string;
  className?: string;
}

function SvgClipCompositorViewInner({
  plate,
  tint,
  aspectRatio = "16/10",
  label,
  className,
}: SvgClipCompositorViewProps) {
  const uid = useId().replace(/:/g, "");
  const tintSpec = useMemo(() => normalizeTintRenderSpec(tint), [tint]);

  const render = useMemo(
    () =>
      resolveLensClipRenderSettings(plate?.clipConfig, {
        lensOpacity: tintSpec.opacity,
      }),
    [plate?.clipConfig, tintSpec.opacity],
  );

  const highlightStrength = useMemo(
    () => resolveHighlightStrength(tintSpec, render.highlightStrength),
    [tintSpec, render.highlightStrength],
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
            <SvgTintGradientDef id={tintId} spec={tintSpec} />
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
              opacity={highlightStrength}
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

function tintRenderKey(spec: NormalizedTintRenderSpec): string {
  return [
    spec.top,
    spec.bottom,
    spec.category,
    spec.opacity,
    spec.gradientDirection,
    spec.gradientAngle,
    spec.gradientMidPosition,
    spec.gradientIntensity,
  ].join("|");
}

export const SvgClipCompositorView = memo(
  SvgClipCompositorViewInner,
  (prev, next) =>
    prev.plate?.plateUrl === next.plate?.plateUrl &&
    tintRenderKey(normalizeTintRenderSpec(prev.tint)) === tintRenderKey(normalizeTintRenderSpec(next.tint)) &&
    prev.aspectRatio === next.aspectRatio &&
    prev.label === next.label &&
    prev.plate?.clipConfig === next.plate?.clipConfig,
);
