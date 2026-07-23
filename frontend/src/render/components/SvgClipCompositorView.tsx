import { memo, useId, useMemo } from "react";

import { usePlateContentBounds } from "@/render/image-bounds";
import {
  normalizeLensClipConfig,
  partitionFrameExclusionObjects,
  resolveFrameExclusionShapes,
  type LensClipConfig,
  type LensClipShape,
  type ResolvedFrameExclusionObject,
} from "@bino-foundry/shared/types";
import { resolveLensClipRenderSettings, type ResolvedLensClipRender } from "@/render/lens-clip/clip-settings";
import { resolvePrototypeGlassAppearance } from "@/render/lens-clip/prototype-glass-appearance";
import { PrototypeGlassElement } from "@/render/lens-clip/PrototypeGlassElement";
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
  return tintSpec;
}

/** Glass Element clip — full lens mold (structure objects are separate layers). */
function GlassElementClipDef({ uid, lens }: { uid: string; lens: LensClipShape }) {
  return (
    <clipPath id={`${uid}-glass-${lens.id}`} clipPathUnits="userSpaceOnUse">
      <path d={lens.pathD} />
    </clipPath>
  );
}

/**
 * One physical frame structure object, masked from the shared plate.
 * Reuses the plate URL — no duplicated SVG assets.
 */
function FrameStructureObject({
  uid,
  object,
  w,
  h,
  plateUrl,
  blendMode,
}: {
  uid: string;
  object: ResolvedFrameExclusionObject;
  w: number;
  h: number;
  plateUrl: string;
  blendMode?: "normal" | "multiply" | "soft-light";
}) {
  const maskId = `${uid}-obj-${object.id}`;
  const opacity = Math.max(0, Math.min(1, object.opacity / 100));
  if (opacity <= 1e-4) return null;
  return (
    <>
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={w} height={h}>
          <rect x={0} y={0} width={w} height={h} fill="#000" />
          <path d={object.pathD} fill="#fff" />
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
        style={blendMode && blendMode !== "normal" ? { mixBlendMode: blendMode } : undefined}
      />
    </>
  );
}

/**
 * Optical-glass compositor:
 * Frame Back → Behind → Original Lens → Material Layers → Inside → Front → Frame Front
 */
const InsertedGlassLayers = memo(function InsertedGlassLayers({
  uid,
  lenses,
  frameObjects,
  w,
  h,
  plateUrl,
  tintSpec,
  render,
}: {
  uid: string;
  lenses: LensClipShape[];
  frameObjects: ResolvedFrameExclusionObject[];
  w: number;
  h: number;
  plateUrl: string;
  tintSpec: NormalizedTintRenderSpec;
  render: ResolvedLensClipRender;
}) {
  const fillSpec = lensFillSpec(tintSpec, render);
  const tintId = `${uid}-tint`;
  const frameBackId = `${uid}-frame-back`;
  const frameFrontId = `${uid}-frame-front`;
  const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
  const { behind, inside, front } = partitionFrameExclusionObjects(frameObjects);

  const perLensGlass = lenses.map((lens) => ({
    lens,
    appearance: resolvePrototypeGlassAppearance(render, fillSpec.top, lens, lenses),
  }));
  const anyGlass = perLensGlass.some((item) => item.appearance.glassPresent);

  const plateImageProps = {
    href: plateUrl,
    x: 0,
    y: 0,
    width: w,
    height: h,
    preserveAspectRatio: "none" as const,
    crossOrigin: "anonymous" as const,
  };

  // When no material layers are active, show the plate as-is (production path with empty layers).
  if (!anyGlass) {
    return <image {...plateImageProps} />;
  }

  return (
    <>
      <defs>
        <mask id={frameBackId} maskUnits="userSpaceOnUse" x={0} y={0} width={w} height={h}>
          <rect x={0} y={0} width={w} height={h} fill="#fff" />
          {lenses.map((lens) => (
            <path key={`${frameBackId}-lens-${lens.id}`} d={lens.pathD} fill="#000" />
          ))}
        </mask>
        <mask id={frameFrontId} maskUnits="userSpaceOnUse" x={0} y={0} width={w} height={h}>
          <rect x={0} y={0} width={w} height={h} fill="#fff" />
          {lenses.map((lens) => (
            <path key={`${frameFrontId}-lens-${lens.id}`} d={lens.pathD} fill="#000" />
          ))}
        </mask>

        <SvgTintGradientDef id={tintId} spec={fillSpec} />

        {lenses.map((lens) => (
          <GlassElementClipDef key={`${uid}-glass-clip-${lens.id}`} uid={uid} lens={lens} />
        ))}
      </defs>

      {/* 1. Frame Back */}
      <image {...plateImageProps} mask={`url(#${frameBackId})`} />

      {/* 2. Behind Glass — viewed through original lens + material layers */}
      {behind.map((object) => (
        <FrameStructureObject
          key={`${uid}-behind-${object.id}`}
          uid={`${uid}-behind`}
          object={object}
          w={w}
          h={h}
          plateUrl={plateUrl}
        />
      ))}

      {/* 3. Original lens foundation — natural texture / gradients / base glass */}
      {lenses.map((lens) => (
        <g key={`${uid}-orig-lens-${lens.id}`} clipPath={`url(#${uid}-glass-${lens.id})`}>
          <image {...plateImageProps} data-layer="original-lens" />
        </g>
      ))}

      {/* 4. Glass material layers (prototype model over the original lens) */}
      {perLensGlass.map(({ lens, appearance }) => (
        <PrototypeGlassElement
          key={`${uid}-glass-el-${lens.id}`}
          uid={uid}
          lens={lens}
          tintId={tintId}
          appearance={appearance}
        />
      ))}

      {/* 5. Inside Glass */}
      {inside.map((object) => (
        <FrameStructureObject
          key={`${uid}-inside-${object.id}`}
          uid={`${uid}-inside`}
          object={object}
          w={w}
          h={h}
          plateUrl={plateUrl}
          blendMode="soft-light"
        />
      ))}

      {/* 6. Front of Glass */}
      {front.map((object) => (
        <FrameStructureObject
          key={`${uid}-front-${object.id}`}
          uid={`${uid}-front`}
          object={object}
          w={w}
          h={h}
          plateUrl={plateUrl}
        />
      ))}

      {/* 7. Frame Front rim */}
      <image
        {...plateImageProps}
        mask={`url(#${frameFrontId})`}
        opacity={clamp01(render.frameExclusionOpacity)}
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

  const { lenses, frameObjects } = useMemo(() => {
    const clip = plate?.clipConfig ? normalizeLensClipConfig(plate.clipConfig) : null;
    return {
      lenses: (clip?.lenses ?? []).filter((l) => l.pathD?.trim()),
      frameObjects: resolveFrameExclusionShapes(clip),
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
            <InsertedGlassLayers
              uid={uid}
              lenses={lenses}
              frameObjects={frameObjects}
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
