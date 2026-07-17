import { memo, useId, useMemo } from "react";

import { usePlateContentBounds } from "@/render/image-bounds";
import {
  normalizeLensClipConfig,
  resolveLensExclusionShapes,
  type LensClipConfig,
  type LensClipShape,
} from "@bino-foundry/shared/types";
import { resolveLensClipRenderSettings, type ResolvedLensClipRender } from "@/render/lens-clip/clip-settings";
import { SvgTintGradientDef } from "@/render/tint/SvgTintGradientDef";
import {
  normalizeTintRenderSpec,
  resolveHighlightStrength,
  type NormalizedTintRenderSpec,
} from "@/render/tint/lens-tint-spec";
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

function lensFillSpec(
  tintSpec: NormalizedTintRenderSpec,
  render: ResolvedLensClipRender,
): NormalizedTintRenderSpec {
  if (!render.gradientEnabled) {
    const solid = render.gradientTopColor ?? tintSpec.top;
    return { ...tintSpec, top: solid, bottom: solid, category: "classic" };
  }
  return {
    ...tintSpec,
    top: render.gradientTopColor ?? tintSpec.top,
    bottom: render.gradientBottomColor ?? tintSpec.bottom,
    gradientMidPosition: render.gradientPosition,
  };
}

function LensClipPathDef({ uid, lens }: { uid: string; lens: LensClipShape }) {
  const exclusions = resolveLensExclusionShapes(lens);
  return (
    <clipPath
      key={`${uid}-clip-${lens.id}`}
      id={`${uid}-clip-${lens.id}`}
      clipPathUnits="userSpaceOnUse"
      clipRule="evenodd"
    >
      <path d={lens.pathD} />
      {exclusions.map((ex) => (
        <path key={`${uid}-clip-${lens.id}-ex-${ex.id}`} d={ex.pathD} />
      ))}
    </clipPath>
  );
}

function ReplaceLensLayers({
  uid,
  lenses,
  w,
  h,
  plateUrl,
  tintSpec,
  render,
  fillOpacity,
}: {
  uid: string;
  lenses: LensClipShape[];
  w: number;
  h: number;
  plateUrl: string;
  tintSpec: NormalizedTintRenderSpec;
  render: ResolvedLensClipRender;
  fillOpacity: number;
}) {
  const fillSpec = lensFillSpec(tintSpec, render);
  const tintId = `${uid}-tint`;
  const knockoutId = `${uid}-knockout`;
  const vignetteId = `${uid}-vignette`;
  const reflectionId = `${uid}-reflection`;
  const glossId = `${uid}-gloss`;
  const polarizedId = `${uid}-polarized`;

  const plateImageProps = {
    href: plateUrl,
    x: 0,
    y: 0,
    width: w,
    height: h,
    preserveAspectRatio: "none" as const,
    crossOrigin: "anonymous" as const,
  };

  return (
    <>
      <defs>
        <mask id={knockoutId} maskUnits="userSpaceOnUse" x={0} y={0} width={w} height={h}>
          <rect x={0} y={0} width={w} height={h} fill="#fff" />
          {lenses.map((lens) => {
            const exclusions = resolveLensExclusionShapes(lens);
            return (
              <g key={`${knockoutId}-${lens.id}`}>
                <path d={lens.pathD} fill="#000" />
                {exclusions.map((ex) => (
                  <path key={`${knockoutId}-${lens.id}-ex-${ex.id}`} d={ex.pathD} fill="#fff" />
                ))}
              </g>
            );
          })}
        </mask>

        <SvgTintGradientDef id={tintId} spec={fillSpec} />

        <radialGradient id={vignetteId} cx="50%" cy="45%" r="72%">
          <stop offset="55%" stopColor="#000" stopOpacity={0} />
          <stop offset="100%" stopColor="#000" stopOpacity={1} />
        </radialGradient>

        <linearGradient id={reflectionId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fff" stopOpacity={0.55} />
          <stop offset="38%" stopColor="#fff" stopOpacity={0.12} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </linearGradient>

        <radialGradient id={glossId} cx="32%" cy="22%" r="28%">
          <stop offset="0%" stopColor="#fff" stopOpacity={0.9} />
          <stop offset="55%" stopColor="#fff" stopOpacity={0.15} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </radialGradient>

        <linearGradient id={polarizedId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.35} />
          <stop offset="50%" stopColor="#38bdf8" stopOpacity={0.12} />
          <stop offset="100%" stopColor="#1e3a8a" stopOpacity={0.28} />
        </linearGradient>

        {lenses.map((lens) => (
          <LensClipPathDef key={`${uid}-clipdef-${lens.id}`} uid={uid} lens={lens} />
        ))}
      </defs>

      {/* 1. Frame with original lens openings removed (exclusions restore plate pixels) */}
      <image {...plateImageProps} mask={`url(#${knockoutId})`} />

      {/* 2–6. Synthetic lens + optical layers inside lens polygon minus exclusions */}
      {lenses.map((lens) => (
        <g key={`${uid}-lens-${lens.id}`} clipPath={`url(#${uid}-clip-${lens.id})`}>
          <rect x={0} y={0} width={w} height={h} fill={`url(#${tintId})`} opacity={fillOpacity} />

          {render.vignetteEnabled ? (
            <rect
              x={0}
              y={0}
              width={w}
              height={h}
              fill={`url(#${vignetteId})`}
              opacity={render.vignetteStrength}
              style={{ mixBlendMode: "multiply" }}
            />
          ) : null}

          {render.reflectionEnabled ? (
            <rect
              x={0}
              y={0}
              width={w}
              height={h}
              fill={`url(#${reflectionId})`}
              opacity={render.reflectionOpacity}
              style={{
                mixBlendMode: "screen",
                filter: render.reflectionBlur > 0 ? `blur(${render.reflectionBlur * 6}px)` : undefined,
              }}
            />
          ) : null}

          {render.glossEnabled ? (
            <rect
              x={0}
              y={0}
              width={w}
              height={h}
              fill={`url(#${glossId})`}
              opacity={render.glossIntensity}
              style={{ mixBlendMode: "screen" }}
            />
          ) : null}

          {render.polarizedEnabled ? (
            <rect
              x={0}
              y={0}
              width={w}
              height={h}
              fill={`url(#${polarizedId})`}
              opacity={render.polarizedStrength}
              style={{ mixBlendMode: "soft-light" }}
            />
          ) : null}
        </g>
      ))}
    </>
  );
}

function OverlayLensLayers({
  uid,
  lenses,
  w,
  h,
  plateUrl,
  tintSpec,
  render,
  fillOpacity,
}: {
  uid: string;
  lenses: LensClipShape[];
  w: number;
  h: number;
  plateUrl: string;
  tintSpec: NormalizedTintRenderSpec;
  render: ResolvedLensClipRender;
  fillOpacity: number;
}) {
  const tintId = `${uid}-tint`;
  const highlightStrength = resolveHighlightStrength(tintSpec, render.highlightStrength);
  const plateImageProps = {
    href: plateUrl,
    x: 0,
    y: 0,
    width: w,
    height: h,
    preserveAspectRatio: "none" as const,
    crossOrigin: "anonymous" as const,
  };

  return (
    <>
      <defs>
        <SvgTintGradientDef id={tintId} spec={tintSpec} />
        {lenses.map((lens) => (
          <LensClipPathDef key={`${uid}-clipdef-${lens.id}`} uid={uid} lens={lens} />
        ))}
      </defs>

      <image {...plateImageProps} />

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
          opacity={fillOpacity}
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
          <image {...plateImageProps} />
        </g>
      ))}
    </>
  );
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
    () => resolveLensClipRenderSettings(plate?.clipConfig),
    [plate?.clipConfig],
  );

  const fillOpacity = useMemo(
    () => Math.max(0.05, Math.min(1, tintSpec.opacity * render.tintOpacity)),
    [tintSpec.opacity, render.tintOpacity],
  );

  const plateW = plate?.width ?? 0;
  const plateH = plate?.height ?? 0;
  const { viewBox } = usePlateContentBounds(plate?.plateUrl, plateW, plateH);

  const lenses = useMemo(() => {
    const clip = plate?.clipConfig ? normalizeLensClipConfig(plate.clipConfig) : null;
    return (clip?.lenses ?? []).filter((l) => l.pathD?.trim());
  }, [plate?.clipConfig]);

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
  const hasLensClip = lenses.length > 0;

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
          {!hasLensClip ? (
            <image
              href={plate.plateUrl}
              x={0}
              y={0}
              width={w}
              height={h}
              preserveAspectRatio="none"
              crossOrigin="anonymous"
            />
          ) : render.mode === "overlay" ? (
            <OverlayLensLayers
              uid={uid}
              lenses={lenses}
              w={w}
              h={h}
              plateUrl={plate.plateUrl}
              tintSpec={tintSpec}
              render={render}
              fillOpacity={fillOpacity}
            />
          ) : (
            <ReplaceLensLayers
              uid={uid}
              lenses={lenses}
              w={w}
              h={h}
              plateUrl={plate.plateUrl}
              tintSpec={tintSpec}
              render={render}
              fillOpacity={fillOpacity}
            />
          )}
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
    prev.plate?.clipConfig === next.plate?.clipConfig &&
    prev.plate?.width === next.plate?.width &&
    prev.plate?.height === next.plate?.height,
);
