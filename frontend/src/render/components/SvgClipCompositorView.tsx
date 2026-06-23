import { memo, useId, useMemo } from "react";

import { usePlateContentBounds } from "@/render/image-bounds";
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
  fillHeight?: boolean;
  compactLabel?: boolean;
}

function SvgClipCompositorViewInner({
  plate,
  tint,
  aspectRatio = "16/10",
  label,
  className,
  fillHeight = false,
  compactLabel = false,
}: SvgClipCompositorViewProps) {
  const uid = useId().replace(/:/g, "");
  const tintSpec = useMemo(() => normalizeTintRenderSpec(tint), [tint]);
  const viewportVariant = fillHeight ? "fill" : "aspect";

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

  const plateW = plate?.width ?? 0;
  const plateH = plate?.height ?? 0;
  const { viewBox } = usePlateContentBounds(plate?.plateUrl, plateW, plateH);

  if (!plate?.plateUrl) {
    return (
      <CompositorViewport
        aspectRatio={aspectRatio}
        label={label}
        className={className}
        variant={viewportVariant}
        compactLabel={compactLabel}
      >
        <p className="text-sm text-muted-foreground">No plate configured for this view</p>
      </CompositorViewport>
    );
  }

  const { width: w, height: h } = plate;
  const lenses = (plate.clipConfig?.lenses ?? []).filter((l) => l.pathD?.trim());
  const hasLensClip = lenses.length > 0;
  const tintId = `${uid}-tint`;

  const plateImageProps = {
    href: plate.plateUrl,
    x: 0,
    y: 0,
    width: w,
    height: h,
    preserveAspectRatio: "none" as const,
    crossOrigin: "anonymous" as const,
  };

  return (
    <CompositorViewport
      aspectRatio={aspectRatio}
      label={label}
      className={className}
      variant={viewportVariant}
      compactLabel={compactLabel}
    >
      <div className="flex h-full w-full items-center justify-center">
        <svg
          viewBox={viewBox}
          className="max-h-full max-w-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={label ?? "Sunglasses preview"}
        >
          {hasLensClip ? (
            <defs>
              <SvgTintGradientDef id={tintId} spec={tintSpec} />
              {lenses.map((lens) => (
                <clipPath
                  key={`${uid}-clip-${lens.id}`}
                  id={`${uid}-clip-${lens.id}`}
                  clipPathUnits="userSpaceOnUse"
                >
                  <path d={lens.pathD} />
                </clipPath>
              ))}
            </defs>
          ) : null}

          <image {...plateImageProps} />

          {hasLensClip
            ? lenses.map((lens) => (
                <g
                  key={`${uid}-sh-${lens.id}`}
                  clipPath={`url(#${uid}-clip-${lens.id})`}
                  style={{ mixBlendMode: "multiply" }}
                  opacity={render.shadowStrength}
                >
                  <rect x={0} y={0} width={w} height={h} fill="#0f172a" />
                </g>
              ))
            : null}

          {hasLensClip
            ? lenses.map((lens) => (
                <g
                  key={`${uid}-tint-${lens.id}`}
                  clipPath={`url(#${uid}-clip-${lens.id})`}
                  style={{ mixBlendMode: render.tintBlendMode }}
                  opacity={render.lensOpacity}
                >
                  <rect x={0} y={0} width={w} height={h} fill={`url(#${tintId})`} />
                </g>
              ))
            : null}

          {hasLensClip
            ? lenses.map((lens) => (
                <g
                  key={`${uid}-hi-${lens.id}`}
                  clipPath={`url(#${uid}-clip-${lens.id})`}
                  style={{ mixBlendMode: render.highlightBlendMode }}
                  opacity={highlightStrength}
                >
                  <image {...plateImageProps} />
                </g>
              ))
            : null}
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
    prev.fillHeight === next.fillHeight &&
    prev.compactLabel === next.compactLabel &&
    prev.plate?.clipConfig === next.plate?.clipConfig,
);
