import { memo, useId, useMemo, type ReactNode } from "react";

import { usePlateContentBounds } from "@/render/image-bounds";
import {
  compoundOccluderPathD,
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
import {
  GlassSheetElement,
  isGlassSheetActive,
} from "@/render/lens-clip/GlassSheetElement";
import { ProceduralGlassBaseElement } from "@/render/lens-clip/ProceduralGlassBaseElement";
import {
  resolveGlassBaseSource,
  resolveGlassCompositionOrder,
  resolveGlassDebugStage,
  shouldReplaceOriginalLens,
  type GlassCompositionOrder,
} from "@/render/lens-clip/glass-composition";
import { AutomaticInnerFrameElement } from "@/render/lens-clip/AutomaticInnerFrameElement";
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
  /**
   * When true (Sunglasses Builder Step 1 — Frame), skip all lens compositing and
   * show the plate image as-is (cropped frame asset; original lens pixels untouched).
   */
  plateOnly?: boolean;
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
          <path d={compoundOccluderPathD(object)} fill="#fff" fillRule="evenodd" />
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
 * True lens replacement compositor (original lens pixels are never the visual base).
 *
 * Default hybrid order (bottom → top):
 * Frame Back → [Behind Details] → Glass Base (sheet|canvas) → Tint / Reflection / Edge →
 * Automatic Inner Frame → Manual Details → Frame Front
 *
 * Internal `glassCompositionOrder` can reorder Frame vs Glass for testing.
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

  const order = resolveGlassCompositionOrder(render);
  const baseSource = resolveGlassBaseSource(render);
  const debugStage = resolveGlassDebugStage(render);
  const sheetActive = baseSource === "sheet" && isGlassSheetActive(render);

  if (debugStage === "original") {
    return (
      <image
        href={plateUrl}
        x={0}
        y={0}
        width={w}
        height={h}
        preserveAspectRatio="none"
        crossOrigin="anonymous"
        data-layer="debug-original"
      />
    );
  }

  // Replacement substrate — never darken / tint the photographed original lens.
  const opticsRender: ResolvedLensClipRender = {
    ...render,
    darkLayerEnabled: debugStage === "glass-base" ? false : render.darkLayerEnabled,
    glassTintEnabled: debugStage === "glass-base" ? false : render.glassTintEnabled,
    tintLayerOpacity: debugStage === "glass-base" ? 0 : render.tintLayerOpacity,
    reflectionEnabled: debugStage === "full" ? render.reflectionEnabled : false,
    edgeEnabled: debugStage === "full" ? render.edgeEnabled : false,
    originalLensColorInfluence: 0,
  };
  const perLensGlass = lenses.map((lens) => ({
    lens,
    appearance: resolvePrototypeGlassAppearance(opticsRender, fillSpec.top, lens, lenses),
  }));

  const plateImageProps = {
    href: plateUrl,
    x: 0,
    y: 0,
    width: w,
    height: h,
    preserveAspectRatio: "none" as const,
    crossOrigin: "anonymous" as const,
  };

  if (!shouldReplaceOriginalLens(lenses.length)) {
    return <image {...plateImageProps} />;
  }

  const glassBase = (
    <>
      {sheetActive
        ? lenses.map((lens) => (
            <GlassSheetElement
              key={`${uid}-sheet-${lens.id}`}
              uid={uid}
              lens={lens}
              render={render}
            />
          ))
        : lenses.map((lens) => (
            <ProceduralGlassBaseElement
              key={`${uid}-canvas-${lens.id}`}
              uid={uid}
              lens={lens}
              render={render}
            />
          ))}
    </>
  );

  const optics =
    debugStage === "glass-base" ? null : (
      <>
        {perLensGlass.map(({ lens, appearance }) => (
          <PrototypeGlassElement
            key={`${uid}-glass-el-${lens.id}`}
            uid={uid}
            lens={lens}
            tintId={tintId}
            appearance={appearance}
          />
        ))}
      </>
    );

  const innerFrames = lenses.map((lens) => (
    <AutomaticInnerFrameElement
      key={`${uid}-inner-frame-${lens.id}`}
      uid={uid}
      lens={lens}
      plateUrl={plateUrl}
      w={w}
      h={h}
      render={render}
    />
  ));

  const behindDetails = behind.map((object) => (
    <FrameStructureObject
      key={`${uid}-behind-${object.id}`}
      uid={`${uid}-behind`}
      object={object}
      w={w}
      h={h}
      plateUrl={plateUrl}
    />
  ));

  const insideDetails = inside.map((object) => (
    <FrameStructureObject
      key={`${uid}-inside-${object.id}`}
      uid={`${uid}-inside`}
      object={object}
      w={w}
      h={h}
      plateUrl={plateUrl}
      blendMode="soft-light"
    />
  ));

  const frontDetails = front.map((object) => (
    <FrameStructureObject
      key={`${uid}-front-${object.id}`}
      uid={`${uid}-front`}
      object={object}
      w={w}
      h={h}
      plateUrl={plateUrl}
    />
  ));

  const frameBack = <image {...plateImageProps} mask={`url(#${frameBackId})`} />;
  const frameFront = (
    <image
      {...plateImageProps}
      mask={`url(#${frameFrontId})`}
      opacity={clamp01(render.frameExclusionOpacity)}
    />
  );

  const stack = composeReplacementLayers(order, {
    frameBack,
    behindDetails,
    glassBase,
    optics,
    innerFrames,
    insideDetails,
    frontDetails,
    frameFront,
  });

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

      {stack}
    </>
  );
});

function composeReplacementLayers(
  order: GlassCompositionOrder,
  layers: {
    frameBack: ReactNode;
    behindDetails: ReactNode;
    glassBase: ReactNode;
    optics: ReactNode;
    innerFrames: ReactNode;
    insideDetails: ReactNode;
    frontDetails: ReactNode;
    frameFront: ReactNode;
  },
): ReactNode {
  const {
    frameBack,
    behindDetails,
    glassBase,
    optics,
    innerFrames,
    insideDetails,
    frontDetails,
    frameFront,
  } = layers;

  if (order === "under-frame") {
    return (
      <>
        {glassBase}
        {optics}
        {innerFrames}
        {frameBack}
        {behindDetails}
        {insideDetails}
        {frontDetails}
        {frameFront}
      </>
    );
  }

  if (order === "over-surface") {
    return (
      <>
        {frameBack}
        {behindDetails}
        {glassBase}
        {optics}
        {innerFrames}
        {insideDetails}
        {frontDetails}
      </>
    );
  }

  // hybrid — realistic default matching Frame Back / Glass / Details / Frame Front
  return (
    <>
      {frameBack}
      {behindDetails}
      {glassBase}
      {optics}
      {innerFrames}
      {insideDetails}
      {frontDetails}
      {frameFront}
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
  plateOnly = false,
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
    if (plateOnly) {
      return { lenses: [] as LensClipShape[], frameObjects: [] as ResolvedFrameExclusionObject[] };
    }
    const clip = plate?.clipConfig ? normalizeLensClipConfig(plate.clipConfig) : null;
    return {
      lenses: (clip?.lenses ?? []).filter((l) => l.pathD?.trim()),
      frameObjects: resolveFrameExclusionShapes(clip),
    };
  }, [plate?.clipConfig, plateOnly]);

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
  const showOriginalPlate = plateOnly || lenses.length === 0;

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
          {showOriginalPlate ? (
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
    prev.plateOnly === next.plateOnly &&
    tintRenderKey(normalizeTintRenderSpec(prev.tint)) === tintRenderKey(normalizeTintRenderSpec(next.tint)) &&
    prev.aspectRatio === next.aspectRatio &&
    prev.label === next.label &&
    prev.fillHeight === next.fillHeight &&
    prev.compactLabel === next.compactLabel &&
    prev.plate?.clipConfig === next.plate?.clipConfig &&
    prev.plate?.width === next.plate?.width &&
    prev.plate?.height === next.plate?.height,
);
