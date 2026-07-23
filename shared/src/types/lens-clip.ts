/** Per-lens SVG clip path in image coordinate space (matches plate width/height). */
export interface LensClipShape {
  id: string;
  label: string;
  /** SVG path `d` attribute (M/L/C/Z) in pixel coords for viewBox 0 0 imageWidth imageHeight */
  pathD: string;
  /**
   * @deprecated Exclusions are now frame-level ({@link LensClipConfig.frameExclusions}).
   * Read only for migrating older per-lens saved configs.
   */
  exclusions?: LensExclusionShape[];
}

/** Where a frame object sits relative to the generated Glass Element. */
export type FrameExclusionLayerOrder = "behind" | "inside" | "front";

/** A single frame-structure polygon path (bridge, screw, rim, etc.). */
export interface LensExclusionShape {
  id: string;
  /** Display name (e.g. "Bridge Support"). */
  label: string;
  pathD: string;
  /**
   * Layer relative to glass. Default `"behind"` (viewed through the glass).
   * - behind — under glass; tint / transmission / absorption apply above it
   * - inside — embedded in the glass material
   * - front — above glass; unaffected by glass optics
   */
  layerOrder?: FrameExclusionLayerOrder;
  /** Object opacity 0–100. Default 100. */
  opacity?: number;
  /** Relative depth within its layer band 0–100 (higher draws later / closer). Default 50. */
  depth?: number;
  /** When false, skipped by the compositor but kept in the editor. Default true. */
  visible?: boolean;
}

/**
 * Frame-level structure object inside a lens opening.
 * These are physical frame components — not glass holes.
 */
export interface FrameExclusionShape extends LensExclusionShape {
  /** @deprecated Legacy association to a lens opening id — no longer used for rendering. */
  lensId?: string;
}

/** Resolved compositor props for one frame object (always fully populated). */
export interface ResolvedFrameExclusionObject extends FrameExclusionShape {
  layerOrder: FrameExclusionLayerOrder;
  opacity: number;
  depth: number;
  visible: boolean;
}

const LAYER_ORDERS = new Set<FrameExclusionLayerOrder>(["behind", "inside", "front"]);

function clampPctField(n: number | undefined, fallback: number): number {
  if (n == null || !Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

/** Apply defaults so legacy polygons (id/label/pathD only) become Behind Glass objects. */
export function resolveFrameExclusionObject(
  shape: LensExclusionShape | FrameExclusionShape,
): ResolvedFrameExclusionObject {
  const layerOrder = LAYER_ORDERS.has(shape.layerOrder as FrameExclusionLayerOrder)
    ? (shape.layerOrder as FrameExclusionLayerOrder)
    : "behind";
  return {
    id: shape.id,
    label: shape.label || "Frame object",
    pathD: shape.pathD,
    lensId: "lensId" in shape ? shape.lensId : undefined,
    layerOrder,
    opacity: clampPctField(shape.opacity, 100),
    depth: clampPctField(shape.depth, 50),
    visible: shape.visible !== false,
  };
}

/**
 * Frame-level optical / compositing settings stored on `clip_config.render`.
 * Customer tint colours still come from `sunglasses_lens_tints`; these tune how the
 * synthetic lens is painted inside the clipping polygons.
 */
export interface LensClipRenderSettings {
  /** Admin scope for opacity controls. Defaults to `global` for legacy configs. */
  renderScope?: "global" | "front" | "side";
  /**
   * Derive optical depth, reflection, density, and transparency from tintLayerOpacity.
   * Defaults to true. When false, every stored material value is used exactly as configured.
   */
  automaticMaterialBehavior?: boolean;
  /**
   * `replace` — knock out original lens pixels and paint a synthetic lens (default).
   * `overlay` is accepted only for reading legacy data; rendering always uses replacement.
   */
  mode?: "replace" | "overlay";

  /** Strength of the selected tint inside the replacement material (0–1). */
  tintOpacity?: number;
  /**
   * Final SVG opacity applied directly to every tint path (0–1). Controls perceived lens
   * thickness/density without changing the selected tint colour or gradient reference.
   */
  tintLayerOpacity?: number;
  /** @deprecated Legacy multiplier; read only when migrating settings saved by v000064. */
  tintFilterOpacity?: number;
  /**
   * Overall opacity of the generated optical material (0–1). Source hue is removed; only
   * normalized luminance/detail may be retained beneath the generated tint.
   */
  lensOpacity?: number;
  /**
   * Fraction of background light transmitted through the generated lens (0–1).
   * Surface reflections remain visible independently, as they would on real glass.
   */
  lensTransmission?: number;
  /** Opacity of restored frame-exclusion pixels (0–1), independent of lens opacity. */
  frameExclusionOpacity?: number;
  /**
   * Opacity of the solid lens base painted beneath the tint (0–1).
   * Keeps the lens reading as real glass instead of a translucent hole, and makes
   * the same tint look identical across frames (no background bleed-through).
   */
  baseTintOpacity?: number;
  /** Amount of neutralized optical/background detail transmitted through the glass (0–1). */
  transparency?: number;
  /** @deprecated Replaced by materialInfluence. Accepted only for legacy data. */
  glassMaterialStrength?: number;
  /**
   * Original source-lens chroma retained before tinting (0–100).
   * 0 keeps luminance only; 100 preserves the source hue/saturation.
   * @deprecated Prefer baseGlassNeutralization (neutralization = 100 − influence).
   */
  originalLensColorInfluence?: number;
  /**
   * Amount of original lens luminance structure preserved beneath the selected tint (0–100).
   * Drives blend weights (`color` vs `multiply`) and is not an opacity or chroma control.
   */
  materialInfluence?: number;
  /** Manual pre-tint brightness adjustment of the original lens (-100 to +100). */
  baseBrightness?: number;
  /** @deprecated Original lens chroma is always removed. Accepted only for legacy data. */
  baseSaturation?: number;
  /** Manual pre-tint tonal response of the original lens (0.50–2.50). */
  baseGamma?: number;
  /** Manual light absorption within the glass body (0–100%). */
  glassAbsorption?: number;
  /** Manual softness of light spreading through the glass (0–100%). */
  glassDiffusion?: number;
  /** Manual perceived optical thickness/depth of the lens (0–100%). Maps to tint depth. */
  glassDepth?: number;

  /**
   * Prototype tint blend mode (`lens-glass-clip.html`).
   * `kaca` = colour + source-over + soft-light stack (recommended).
   */
  glassTintBlend?: "kaca" | "color" | "source-over" | "multiply";
  /** Surface shine / kilau (0–100). Prototype tint.shine. */
  glassTintShine?: number;
  /** When false, tint material layer is skipped. Default true. */
  glassTintEnabled?: boolean;

  /** Dark material layer above the original lens (prototype Layer gelap). */
  darkLayerEnabled?: boolean;
  /** Dark layer opacity (0–100). */
  darkLayerOpacity?: number;
  /** Flat fill vs graduated glass sheen. */
  darkLayerMode?: "flat" | "gradasi";
  /** Dark layer fill colour (hex). */
  darkLayerColor?: string;
  /** Dark layer composite: source-over (normal) or multiply. */
  darkLayerBlend?: "source-over" | "multiply";
  /** Gradasi sheen intensity (0–100). */
  darkLayerGlow?: number;
  /** Gradasi sheen band width (0–100). */
  darkLayerGlowSize?: number;
  /** Sheen position X within lens (0–100). */
  darkLayerGlowX?: number;
  /** Sheen position Y within lens (0–100). */
  darkLayerGlowY?: number;
  /** Sheen softness (0–100). */
  darkLayerSoft?: number;
  /** Extra bottom edge darkening in gradasi mode (0–100). */
  darkLayerEdge?: number;

  /** When false, edge density/opacity layers are skipped. Default true. */
  edgeEnabled?: boolean;

  /**
   * Optical density gradient across the lens (independent of customer tint HEX).
   * Default false so existing presets keep uniform density.
   */
  densityGradientEnabled?: boolean;
  /** Gradient direction. `none` disables the effect even when enabled. */
  densityGradientMode?: "none" | "vertical" | "horizontal" | "radial" | "angle";
  /** Custom angle in degrees (0 = left→right, 90 = top→bottom). Used when mode is `angle`. */
  densityGradientAngle?: number;
  /** When true, blend between start/end colours; otherwise density-only (tint hue unchanged). */
  densityGradientTwoColor?: boolean;
  /** Gradient start colour (hex). */
  densityGradientStartColor?: string | null;
  /** Gradient end colour (hex). */
  densityGradientEndColor?: string | null;
  /**
   * @deprecated Prefer densityGradientStartFalloff / densityGradientEndFalloff.
   * Kept for reading older presets.
   */
  densityGradientStrength?: number;
  /**
   * @deprecated Softness is superseded by independent start/end falloff.
   * Kept for reading older presets.
   */
  densityGradientSoftness?: number;
  /** Mid-transition position along the gradient axis (0–100). */
  densityGradientPosition?: number;
  /**
   * How long the start density holds before transitioning (0–100).
   * Low = changes almost immediately; high = stays dense longer near the start.
   */
  densityGradientStartFalloff?: number;
  /**
   * How gradually the end density is approached (0–100).
   * Low = snaps to the end; high = soft, drawn-out landing.
   */
  densityGradientEndFalloff?: number;
  /** Transition character between start and end. */
  densityGradientCurve?: "linear" | "ease-in" | "ease-out" | "ease-in-out";

  /** Optical colour adjustments; 1 is neutral. */
  brightness?: number;
  contrast?: number;
  saturation?: number;
  /** Prefer customer tint gradient when true (default). */
  gradientEnabled?: boolean;
  /** Optional frame-level gradient colour overrides (hex). */
  gradientTopColor?: string | null;
  gradientBottomColor?: string | null;
  /** Vertical mid-stop 0–100 (darker top → lighter bottom emphasis). */
  gradientPosition?: number;
  /** Strength of the gradient layer over the translucent glass base (0–1). */
  gradientStrength?: number;

  reflectionEnabled?: boolean;
  /** Highlight strength within the independent reflection layer (0–1). */
  reflectionStrength?: number;
  /** Overall reflection-layer visibility (0–1). */
  reflectionOpacity?: number;
  /** Reflection rotation in degrees. */
  reflectionAngle?: number;
  /** Blur / edge softness (0–1). */
  reflectionBlur?: number;
  /** @deprecated Signed diagonal offset; use reflectionOffsetX / reflectionOffsetY. */
  reflectionPosition?: number;
  /** Horizontal reflection offset (-100 to 100). */
  reflectionOffsetX?: number;
  /** Vertical reflection offset (-100 to 100). */
  reflectionOffsetY?: number;
  /** Reflection highlight size multiplier (0.5–1.75). Primary / left lens. */
  reflectionScale?: number;
  /**
   * When true (default), the right-lens reflection mirrors the left-lens controls.
   * When false, right-lens reflection knobs are edited independently.
   */
  mirrorReflection?: boolean;
  /** Independent right-lens reflection rotation (degrees). Used when mirrorReflection is false. */
  reflectionRightAngle?: number;
  /** Independent right-lens horizontal reflection offset (-100 to 100). */
  reflectionRightOffsetX?: number;
  /** Independent right-lens vertical reflection offset (-100 to 100). */
  reflectionRightOffsetY?: number;
  /** Independent right-lens reflection scale (0.5–1.75). */
  reflectionRightScale?: number;
  /** Independent right-lens reflection opacity (0–1). Used when mirrorReflection is false. */
  reflectionRightOpacity?: number;
  /** Independent right-lens reflection softness / blur (0–1). Used when mirrorReflection is false. */
  reflectionRightBlur?: number;

  /**
   * Perceived darkness of the original glass material before tint (0–100).
   * 0 = very clear optical glass; 100 = naturally dark sunglass glass.
   * Does not change the selected tint colour.
   */
  baseGlassDarkness?: number;
  /**
   * How deep and premium the base glass material appears (0–100).
   * Adds thickness / richness without changing tint colour.
   */
  baseGlassRichness?: number;
  /**
   * How much of the original lens colour is removed before tinting (0–100).
   * 0 = original colour remains; 100 = almost completely neutralised.
   * Manual calibration only — no automatic colour analysis.
   */
  baseGlassNeutralization?: number;

  /** @deprecated Use baseGlassDarkness. */
  glassBaseDensity?: number;
  /** @deprecated Use baseGlassRichness. */
  baseDensityBias?: number;

  /** Extremely subtle light bounce within the glass body. */
  internalReflectionEnabled?: boolean;
  internalReflectionOpacity?: number;
  internalReflectionSoftness?: number;
  internalReflectionScale?: number;
  internalReflectionAngle?: number;

  /** Natural edge-angle brightness response, rendered as a feathered fill rather than a stroke. */
  fresnelEnabled?: boolean;
  fresnelStrength?: number;
  fresnelWidth?: number;
  fresnelSoftness?: number;

  glossEnabled?: boolean;
  glossIntensity?: number;
  /** Preferred name for gloss intensity; `glossIntensity` remains compatible. */
  glossStrength?: number;

  vignetteEnabled?: boolean;
  vignetteStrength?: number;
  /** Preferred name for edge vignette strength; `vignetteStrength` remains compatible. */
  edgeFade?: number;
  /** Darkness of the subtle inner lens rim / optical thickness (0–1). */
  edgeDarkness?: number;
  /** Inner rim width as a fraction of the shorter source-image dimension (0–0.05). */
  edgeWidth?: number;

  /**
   * Global transparency of the synthetic lens (0–1). Higher reveals more of the scene
   * rendered behind the lens (the transparent, knocked-out opening) — never the original
   * lens texture, which is discarded entirely.
   */
  backgroundVisibility?: number;
  /**
   * Thins the coloured lens body so the background shows through the tint (0–1). Affects
   * the rendered scene behind the lens only; never reveals original lens pixels.
   */
  environmentTransparency?: number;
  /** Density reinforcement toward the lens centre (0–1). Independent of tint opacity. */
  centerDensity?: number;
  /** Outer-edge thickness darkening (0–1). Independent of tint opacity. */
  edgeDensity?: number;
  /** Feathering of the denser perimeter transition (0–1). */
  edgeSoftness?: number;
  /** Overall visibility of edge absorption (0–1). */
  edgeOpacity?: number;

  polarizedEnabled?: boolean;
  polarizedStrength?: number;

  /** @deprecated Overlay-mode only. */
  tintBlendMode?: "multiply" | "screen" | "overlay" | "color" | "soft-light";
  /** @deprecated Overlay-mode only. */
  highlightStrength?: number;
  /** @deprecated Overlay-mode only. */
  highlightBlendMode?: "screen" | "overlay" | "soft-light";
  /** @deprecated Overlay-mode only. */
  shadowStrength?: number;
}

export const LENS_CLIP_CONFIG_V1 = 1 as const;

/** Stored in `frame_render_views.clip_config` — primary tint clipping definition. */
export interface LensClipConfig {
  version: typeof LENS_CLIP_CONFIG_V1;
  imageWidth: number;
  imageHeight: number;
  lenses: LensClipShape[];
  /**
   * Frame structure objects inside lens openings (bridge, screws, rim, nylon, etc.).
   * Each is a render object with layer order (behind / inside / front of glass).
   * They are not glass holes — they remain visible as physical frame components.
   */
  frameExclusions?: FrameExclusionShape[];
  render?: LensClipRenderSettings;
  updatedAt?: number;
}

export function isLensClipConfigValid(config: unknown): config is LensClipConfig {
  if (!config || typeof config !== "object") return false;
  const c = config as LensClipConfig;
  if (c.version !== LENS_CLIP_CONFIG_V1) return false;
  if (!c.imageWidth || !c.imageHeight) return false;
  if (!Array.isArray(c.lenses) || c.lenses.length === 0) return false;
  return c.lenses.some((l) => typeof l.pathD === "string" && l.pathD.trim().length > 8);
}

export function createLensClipConfig(
  imageWidth: number,
  imageHeight: number,
  lenses: LensClipShape[],
  render?: LensClipRenderSettings,
): LensClipConfig {
  return {
    version: LENS_CLIP_CONFIG_V1,
    imageWidth,
    imageHeight,
    lenses,
    render,
    updatedAt: Date.now(),
  };
}

function isUsablePathD(pathD: string | undefined): boolean {
  return typeof pathD === "string" && pathD.trim().length > 8;
}

/** Exclusion holes stored on a single lens clip shape. */
export function resolveLensExclusionShapes(
  lens: Pick<LensClipShape, "exclusions"> | null | undefined,
): LensExclusionShape[] {
  const list = lens?.exclusions;
  if (!Array.isArray(list)) return [];
  return list.filter((s) => isUsablePathD(s?.pathD));
}

/**
 * The merged frame-level structure-object list.
 *
 * Collects canonical root `frameExclusions` plus any legacy per-lens `exclusions[]`
 * into a single flat list. Missing layer/opacity/depth/visibility default to
 * Behind Glass / 100% / visible.
 */
export function resolveFrameExclusionShapes(
  clip: Pick<LensClipConfig, "frameExclusions" | "lenses"> | null | undefined,
): ResolvedFrameExclusionObject[] {
  if (!clip) return [];
  const out: ResolvedFrameExclusionObject[] = [];
  const seen = new Set<string>();

  const push = (shape: LensExclusionShape | FrameExclusionShape | undefined) => {
    if (!isUsablePathD(shape?.pathD)) return;
    const resolved = resolveFrameExclusionObject(shape!);
    let id = resolved.id || `frame-exclusion-${out.length}`;
    while (seen.has(id)) id = `${id}-${out.length}`;
    seen.add(id);
    out.push({ ...resolved, id });
  };

  for (const shape of clip.frameExclusions ?? []) push(shape);
  for (const lens of clip.lenses ?? []) {
    for (const shape of resolveLensExclusionShapes(lens)) push(shape);
  }

  return out;
}

/** Partition visible frame objects by glass layer, sorted by depth within each band. */
export function partitionFrameExclusionObjects(
  objects: ResolvedFrameExclusionObject[],
): {
  behind: ResolvedFrameExclusionObject[];
  inside: ResolvedFrameExclusionObject[];
  front: ResolvedFrameExclusionObject[];
} {
  const byDepth = (a: ResolvedFrameExclusionObject, b: ResolvedFrameExclusionObject) =>
    a.depth - b.depth || a.label.localeCompare(b.label);
  const visible = objects.filter((o) => o.visible);
  return {
    behind: visible.filter((o) => o.layerOrder === "behind").sort(byDepth),
    inside: visible.filter((o) => o.layerOrder === "inside").sort(byDepth),
    front: visible.filter((o) => o.layerOrder === "front").sort(byDepth),
  };
}

/**
 * Normalize to the canonical frame-level shape: gather every exclusion (root + legacy
 * per-lens) into root `frameExclusions` and strip per-lens `exclusions`. Frames without
 * any exclusions are returned unchanged (aside from dropping empty keys).
 */
export function normalizeLensClipConfig(clip: LensClipConfig): LensClipConfig {
  const frameExclusions = resolveFrameExclusionShapes(clip);
  const lenses = clip.lenses.map((lens) => {
    if (!lens.exclusions) return lens;
    const { exclusions: _drop, ...rest } = lens;
    return rest;
  });

  const { frameExclusions: _dropRoot, ...rest } = clip;
  if (!frameExclusions.length) {
    return { ...rest, lenses };
  }
  return {
    ...rest,
    lenses,
    frameExclusions,
    updatedAt: clip.updatedAt ?? Date.now(),
  };
}
