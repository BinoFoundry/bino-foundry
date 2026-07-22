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
import { resolveGlassMaterialFilterParams } from "@/render/lens-clip/glass-material-filter";
import { GlassMaterialFilterDef } from "@/render/lens-clip/GlassMaterialFilterDef";
import {
  resolveLensManualCalibration,
  resolveMaterialInfluence,
} from "@/render/lens-clip/lens-glass-material";
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
      <path d={lens.pathD} />
    </clipPath>
  );
}

/**
 * Frame Exclusions — paints the ORIGINAL frame plate above the rendered lens, masked to
 * frame-exclusion polygons, so bridge / screws / inner rim stay visible.
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

/**
 * Replace-lens compositor: one reusable glass material filter + one tinted path per opening.
 * Optical depth, edge absorption, diffusion, and reflection live inside the filter — not
 * as stacked overlay groups.
 */
const ReplaceLensLayers = memo(function ReplaceLensLayers({
  uid,
  lenses,
  frameExclusions,
  w,
  h,
  plateUrl,
  tintSpec,
  render,
}: {
  uid: string;
  lenses: LensClipShape[];
  frameExclusions: FrameExclusionShape[];
  w: number;
  h: number;
  plateUrl: string;
  tintSpec: NormalizedTintRenderSpec;
  render: ResolvedLensClipRender;
}) {
  const fillSpec = lensFillSpec(tintSpec, render);
  const tintId = `${uid}-tint`;
  const knockoutId = `${uid}-knockout`;
  const baseCalibrationFilterId = `${uid}-base-calibration`;
  const glassMaterialId = `${uid}-glassMaterial`;
  const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

  const calibration = resolveLensManualCalibration(
    render.baseBrightness,
    render.baseGamma,
  );
  const material = resolveMaterialInfluence(render.materialInfluence);
  const filterParams = resolveGlassMaterialFilterParams(render, w, h);

  const backgroundReveal = clamp01(render.backgroundVisibility);
  const transmission = clamp01(render.lensTransmission);
  // Subtle plate luminance under the filtered tint — not a material overlay path.
  const foundationOpacity =
    (1 - backgroundReveal) * (0.28 + transmission * 0.55) * (1 - filterParams.environmentVisibility);
  const tintAlpha = clamp01(render.tintLayerOpacity);
  const applyCalibration = tintAlpha > 0 || !calibration.isIdentity;

  // One tinted path: choose the dominant blend so Material Influence stays a blend weight.
  const useLuminancePreserve = material.luminancePreserveFactor >= material.valueDominanceFactor;
  const tintOpacity = useLuminancePreserve
    ? filterParams.bodyOpacity * Math.max(material.luminancePreserveFactor, 0.35)
    : filterParams.bodyOpacity *
      Math.max(material.valueDominanceFactor * material.valueBlendGain, 0.35);
  const tintBlendMode = useLuminancePreserve ? "color" : "multiply";

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
          {lenses.map((lens) => (
            <path key={`${knockoutId}-${lens.id}`} d={lens.pathD} fill="#000" />
          ))}
        </mask>

        <SvgTintGradientDef id={tintId} spec={fillSpec} />

        {applyCalibration ? (
          <filter
            id={baseCalibrationFilterId}
            x="0%"
            y="0%"
            width="100%"
            height="100%"
            colorInterpolationFilters="sRGB"
          >
            <feComponentTransfer in="SourceGraphic" result="brightened">
              <feFuncR
                type="linear"
                slope={1}
                intercept={calibration.brightnessOffset}
              />
              <feFuncG
                type="linear"
                slope={1}
                intercept={calibration.brightnessOffset}
              />
              <feFuncB
                type="linear"
                slope={1}
                intercept={calibration.brightnessOffset}
              />
              <feFuncA type="identity" />
            </feComponentTransfer>
            <feColorMatrix
              in="brightened"
              type="saturate"
              values={render.originalLensColorInfluence / 100}
              result="neutralFoundation"
            />
            <feComponentTransfer in="neutralFoundation">
              <feFuncR type="gamma" amplitude={1} exponent={calibration.gamma} offset={0} />
              <feFuncG type="gamma" amplitude={1} exponent={calibration.gamma} offset={0} />
              <feFuncB type="gamma" amplitude={1} exponent={calibration.gamma} offset={0} />
              <feFuncA type="identity" />
            </feComponentTransfer>
          </filter>
        ) : null}

        {/* One shared optical engine for every lens opening. */}
        <GlassMaterialFilterDef id={glassMaterialId} params={filterParams} />

        {lenses.map((lens) => (
          <LensClipPathDef key={`${uid}-clipdef-${lens.id}`} uid={uid} lens={lens} />
        ))}
      </defs>

      {/* 1. Frame body (lens openings punched out). */}
      <image {...plateImageProps} mask={`url(#${knockoutId})`} />

      {/* 2. Each opening: foundation luminance + one filtered tint path. */}
      {lenses.map((lens) => (
        <g
          key={`${uid}-lens-${lens.id}`}
          clipPath={`url(#${uid}-clip-${lens.id})`}
        >
          {foundationOpacity > 0 ? (
            <image
              {...plateImageProps}
              opacity={foundationOpacity}
              filter={applyCalibration ? `url(#${baseCalibrationFilterId})` : undefined}
            />
          ) : null}

          {tintOpacity > 0 ? (
            <path
              d={lens.pathD}
              fill={`url(#${tintId})`}
              opacity={tintOpacity}
              filter={`url(#${glassMaterialId})`}
              style={{ mixBlendMode: tintBlendMode }}
            />
          ) : null}
        </g>
      ))}

      {/* 3. Frame exclusions restore hardware above the lens. */}
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
