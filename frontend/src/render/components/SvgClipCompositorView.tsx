import { memo, useId, useMemo } from "react";

import { usePlateContentBounds } from "@/render/image-bounds";
import {
  normalizeLensClipConfig,
  resolveFrameExclusionShapes,
  type FrameExclusionShape,
  type LensClipConfig,
  type LensClipShape,
} from "@bino-foundry/shared/types";
import { resolveLensClipRenderSettings, type ResolvedLensClipRender } from "@/render/lens-clip/clip-settings";
import { resolveLensGlassMaterialParams } from "@/render/lens-clip/lens-glass-material";
import { SvgTintGradientDef } from "@/render/tint/SvgTintGradientDef";
import {
  normalizeTintRenderSpec,
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
  _render: ResolvedLensClipRender,
): NormalizedTintRenderSpec {
  // Catalogue tint colours are the sole chromatic source. Frame-level render settings may
  // tune optics but must never override the customer-selected hue per frame.
  return tintSpec;
}

function LensClipPathDef({ uid, lens }: { uid: string; lens: LensClipShape }) {
  return (
    <clipPath
      key={`${uid}-clip-${lens.id}`}
      id={`${uid}-clip-${lens.id}`}
      clipPathUnits="userSpaceOnUse"
    >
      {/* Lens fills the whole opening — frame parts are restored later via overlay. */}
      <path d={lens.pathD} />
    </clipPath>
  );
}

/**
 * Frame Exclusions — the final compositing step. Paints the ORIGINAL frame plate above the
 * rendered lens, masked to the frame-exclusion polygons, so frame hardware (bridge, screws,
 * inner rim, support bars) inside the opening stays fully visible regardless of lens tint.
 * Renders nothing when a frame has no exclusions, preserving legacy behaviour.
 */
function FrameExclusionOverlay({
  uid,
  exclusions,
  w,
  h,
  plateUrl,
  opacity,
}: {
  uid: string;
  exclusions: FrameExclusionShape[];
  w: number;
  h: number;
  plateUrl: string;
  opacity: number;
}) {
  if (!exclusions.length) return null;
  const maskId = `${uid}-frame-exclusions`;
  return (
    <>
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={w} height={h}>
          <rect x={0} y={0} width={w} height={h} fill="#000" />
          {exclusions.map((ex) => (
            <path key={`${maskId}-${ex.id}`} d={ex.pathD} fill="#fff" />
          ))}
        </mask>
      </defs>
      <image
        href={plateUrl}
        x={0}
        y={0}
        width={w}
        height={h}
        preserveAspectRatio="none"
        crossOrigin="anonymous"
        mask={`url(#${maskId})`}
        opacity={opacity}
      />
    </>
  );
}

const ReplaceLensLayers = memo(function ReplaceLensLayers({
  uid,
  lenses,
  frameExclusions,
  w,
  h,
  plateUrl,
  tintSpec,
  render,
  fillOpacity,
}: {
  uid: string;
  lenses: LensClipShape[];
  frameExclusions: FrameExclusionShape[];
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
  const glassBaseId = `${uid}-glass-base`;
  const depthId = `${uid}-depth`;
  const vignetteId = `${uid}-vignette`;
  const reflectionId = `${uid}-reflection`;
  const reflectionBlurId = `${uid}-reflection-blur`;
  const glossId = `${uid}-gloss`;
  const specularId = `${uid}-specular`;
  const polarizedId = `${uid}-polarized`;
  // Knockout removes the original coloured lens from the plate. The synthetic material is
  // painted from scratch; the source plate is never sampled inside the clip opening.
  const { bodyOpacity, edgeWidthPx, reflectionBlurPx } = resolveLensGlassMaterialParams(
    render,
    w,
    h,
  );

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
          {/* Remove the full lens opening; frame parts are restored on top via overlay. */}
          {lenses.map((lens) => (
            <path key={`${knockoutId}-${lens.id}`} d={lens.pathD} fill="#000" />
          ))}
        </mask>

        <SvgTintGradientDef id={tintId} spec={fillSpec} />

        {/* Achromatic glass substrate — luminance and vertical depth only, never a hue.
            The selected tint is the single chromatic source, so the same tint renders the
            same colour on every frame regardless of the original lens colour. */}
        <linearGradient id={glassBaseId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.3} />
          <stop offset="48%" stopColor="#e6e6e6" stopOpacity={0.08} />
          <stop offset="100%" stopColor="#9a9a9a" stopOpacity={0.14} />
        </linearGradient>

        <linearGradient id={depthId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fff" stopOpacity={0.22} />
          <stop offset="44%" stopColor="#fff" stopOpacity={0.02} />
          <stop offset="70%" stopColor="#07111b" stopOpacity={0.03} />
          <stop offset="100%" stopColor="#07111b" stopOpacity={0.2} />
        </linearGradient>

        <radialGradient id={vignetteId} cx="50%" cy="45%" r="72%">
          <stop offset="72%" stopColor="#000" stopOpacity={0} />
          <stop offset="100%" stopColor="#000" stopOpacity={1} />
        </radialGradient>

        <linearGradient
          id={reflectionId}
          x1="0%"
          y1="0%"
          x2="0%"
          y2="100%"
          gradientTransform={`rotate(${render.reflectionAngle} .5 .5)`}
        >
          <stop offset="0%" stopColor="#fff" stopOpacity={0} />
          <stop offset="18%" stopColor="#fff" stopOpacity={0.08} />
          <stop offset="34%" stopColor="#fff" stopOpacity={0.52} />
          <stop offset="52%" stopColor="#fff" stopOpacity={0.15} />
          <stop offset="72%" stopColor="#fff" stopOpacity={0} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </linearGradient>

        <radialGradient id={glossId} cx="30%" cy="18%" r="42%">
          <stop offset="0%" stopColor="#fff" stopOpacity={0.48} />
          <stop offset="50%" stopColor="#fff" stopOpacity={0.08} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </radialGradient>

        <linearGradient
          id={specularId}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
          gradientTransform={`rotate(${render.reflectionAngle - 12} .5 .5)`}
        >
          <stop offset="0%" stopColor="#fff" stopOpacity={0} />
          <stop offset="30%" stopColor="#fff" stopOpacity={0} />
          <stop offset="42%" stopColor="#fff" stopOpacity={0.38} />
          <stop offset="52%" stopColor="#fff" stopOpacity={0.06} />
          <stop offset="64%" stopColor="#fff" stopOpacity={0} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </linearGradient>

        <linearGradient id={polarizedId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.35} />
          <stop offset="50%" stopColor="#38bdf8" stopOpacity={0.12} />
          <stop offset="100%" stopColor="#1e3a8a" stopOpacity={0.28} />
        </linearGradient>

        {reflectionBlurPx > 0 ? (
          <filter
            id={reflectionBlurId}
            x="-12%"
            y="-12%"
            width="124%"
            height="124%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation={reflectionBlurPx} />
          </filter>
        ) : null}

        {lenses.map((lens) => (
          <LensClipPathDef key={`${uid}-clipdef-${lens.id}`} uid={uid} lens={lens} />
        ))}
      </defs>

      {/* 1. Frame with the full lens openings removed. */}
      <image {...plateImageProps} mask={`url(#${knockoutId})`} />

      {/* 2–6. Synthetic lens + optical layers inside each lens opening. */}
      {lenses.map((lens) => (
        <g
          key={`${uid}-lens-${lens.id}`}
          clipPath={`url(#${uid}-clip-${lens.id})`}
        >
          {/* Synthetic glass body — achromatic substrate + catalogue tint only. */}
          <g opacity={bodyOpacity}>
            <path d={lens.pathD} fill={`url(#${glassBaseId})`} opacity={0.22} />
            <path d={lens.pathD} fill={`url(#${tintId})`} opacity={fillOpacity} />

            {render.gradientEnabled ? (
              <path
                d={lens.pathD}
                fill={`url(#${depthId})`}
                opacity={render.gradientStrength}
              />
            ) : null}

            {render.vignetteEnabled ? (
              <path
                d={lens.pathD}
                fill={`url(#${vignetteId})`}
                opacity={render.edgeFade * 0.28}
              />
            ) : null}
          </g>

          {/* Surface reflection remains visible even on highly transmissive glass. */}
          {render.reflectionEnabled ? (
            <path
              d={lens.pathD}
              fill={`url(#${reflectionId})`}
              opacity={render.reflectionOpacity * render.reflectionStrength}
              filter={reflectionBlurPx > 0 ? `url(#${reflectionBlurId})` : undefined}
            />
          ) : null}

          {render.glossEnabled ? (
            <>
              <path
                d={lens.pathD}
                fill={`url(#${glossId})`}
                opacity={render.glossStrength}
              />
              <path
                d={lens.pathD}
                fill={`url(#${specularId})`}
                opacity={render.highlightStrength}
              />
            </>
          ) : null}

          {/* Two restrained inner strokes suggest polished optical thickness without a halo. */}
          {render.vignetteEnabled ? (
            <>
              <path
                d={lens.pathD}
                fill="none"
                stroke="#08141b"
                strokeWidth={edgeWidthPx * 2}
                strokeLinejoin="round"
                opacity={render.edgeDarkness}
              />
              <path
                d={lens.pathD}
                fill="none"
                stroke="#f8fcff"
                strokeWidth={Math.max(0.35, edgeWidthPx * 0.35)}
                strokeLinejoin="round"
                opacity={render.edgeDarkness * 0.16}
              />
            </>
          ) : null}

          {render.polarizedEnabled ? (
            <path
              d={lens.pathD}
              fill={`url(#${polarizedId})`}
              opacity={render.polarizedStrength}
            />
          ) : null}
        </g>
      ))}

      {/* 7. Frame Exclusions — restore frame hardware above the lens. */}
      <FrameExclusionOverlay
        uid={uid}
        exclusions={frameExclusions}
        w={w}
        h={h}
        plateUrl={plateUrl}
        opacity={render.frameExclusionOpacity}
      />
    </>
  );
});

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

  const { lenses, frameExclusions } = useMemo(() => {
    const clip = plate?.clipConfig ? normalizeLensClipConfig(plate.clipConfig) : null;
    return {
      lenses: (clip?.lenses ?? []).filter((l) => l.pathD?.trim()),
      frameExclusions: resolveFrameExclusionShapes(clip),
    };
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
          ) : (
            <ReplaceLensLayers
              uid={uid}
              lenses={lenses}
              frameExclusions={frameExclusions}
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
