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

function ReplaceLensLayers({
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
  const glossId = `${uid}-gloss`;
  const specularId = `${uid}-specular`;
  const polarizedId = `${uid}-polarized`;
  // Every value below belongs exclusively to the NEW material. The source lens pixels are
  // removed by the knockout and never sampled inside the lens clip.
  const baseColor = fillSpec.bottom || fillSpec.top;
  const glassBaseOpacity = 0.22;
  const baseOpacity = 0.16;
  const materialTintOpacity = fillOpacity * 0.76;
  const opticalFilter =
    `brightness(${render.brightness}) contrast(${render.contrast}) saturate(${render.saturation})`;

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

        <linearGradient id={glassBaseId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f8fbff" stopOpacity={0.9} />
          <stop offset="42%" stopColor="#dce8ef" stopOpacity={0.22} />
          <stop offset="100%" stopColor="#6b7f8c" stopOpacity={0.38} />
        </linearGradient>

        <linearGradient id={depthId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fff" stopOpacity={0.3} />
          <stop offset="45%" stopColor="#fff" stopOpacity={0} />
          <stop offset="100%" stopColor="#07111b" stopOpacity={0.58} />
        </linearGradient>

        <radialGradient id={vignetteId} cx="50%" cy="45%" r="72%">
          <stop offset="55%" stopColor="#000" stopOpacity={0} />
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
          <stop offset="0%" stopColor="#fff" stopOpacity={0.55} />
          <stop offset="38%" stopColor="#fff" stopOpacity={0.12} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </linearGradient>

        <radialGradient id={glossId} cx="32%" cy="22%" r="28%">
          <stop offset="0%" stopColor="#fff" stopOpacity={0.9} />
          <stop offset="55%" stopColor="#fff" stopOpacity={0.15} />
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
          <stop offset="42%" stopColor="#fff" stopOpacity={0.82} />
          <stop offset="51%" stopColor="#fff" stopOpacity={0.12} />
          <stop offset="64%" stopColor="#fff" stopOpacity={0} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </linearGradient>

        <linearGradient id={polarizedId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.35} />
          <stop offset="50%" stopColor="#38bdf8" stopOpacity={0.12} />
          <stop offset="100%" stopColor="#1e3a8a" stopOpacity={0.28} />
        </linearGradient>

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
          opacity={render.lensOpacity}
          style={{ filter: opticalFilter }}
        >
          {/* Clear glass substrate and a restrained colour body. */}
          <rect
            x={0}
            y={0}
            width={w}
            height={h}
            fill={`url(#${glassBaseId})`}
            opacity={glassBaseOpacity}
          />
          <rect x={0} y={0} width={w} height={h} fill={baseColor} opacity={baseOpacity} />

          {/* Selected tint stays distinct from the material-depth gradient. */}
          <rect
            x={0}
            y={0}
            width={w}
            height={h}
            fill={`url(#${tintId})`}
            opacity={materialTintOpacity}
          />

          {render.gradientEnabled ? (
            <rect
              x={0}
              y={0}
              width={w}
              height={h}
              fill={`url(#${depthId})`}
              opacity={render.gradientStrength * 0.42}
            />
          ) : null}

          {render.reflectionEnabled ? (
            <rect
              x={0}
              y={0}
              width={w}
              height={h}
              fill={`url(#${reflectionId})`}
              opacity={render.reflectionOpacity * render.reflectionStrength}
              style={{
                filter: render.reflectionBlur > 0 ? `blur(${render.reflectionBlur * 6}px)` : undefined,
              }}
            />
          ) : null}

          {render.glossEnabled ? (
            <>
              <rect
                x={0}
                y={0}
                width={w}
                height={h}
                fill={`url(#${glossId})`}
                opacity={render.glossStrength}
              />
              <rect
                x={0}
                y={0}
                width={w}
                height={h}
                fill={`url(#${specularId})`}
                opacity={render.highlightStrength}
              />
            </>
          ) : null}

          {render.vignetteEnabled ? (
            <rect
              x={0}
              y={0}
              width={w}
              height={h}
              fill={`url(#${vignetteId})`}
              opacity={render.edgeFade * 0.55}
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
