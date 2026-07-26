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

/** Where a frame/glass-occluder object sits relative to the glass. */
export type FrameExclusionLayerOrder = "behind" | "inside" | "front";

/**
 * Alias for admin/docs: Behind Glass (`behind`) or Above Glass (`front`).
 * `inside` remains supported for legacy configs (soft-light mid-band).
 */
export type GlassOccluderLayer = FrameExclusionLayerOrder;

/** A single frame-structure / glass-occluder polygon path (bridge, screw, rim, etc.). */
export interface LensExclusionShape {
  id: string;
  /** Display name (e.g. "Nose Bridge", "Inner Lip"). */
  label: string;
  /**
   * Outer closed SVG path `d` (M/L/C/Z).
   * Combined with {@link holePathDs} via `fill-rule="evenodd"` at render time.
   */
  pathD: string;
  /**
   * Optional inner hole paths (closed subpaths). Each is subtracted from the outer
   * via even-odd fill — same model as Illustrator/Figma compound paths.
   * Legacy occluders omit this (outer only, zero holes).
   */
  holePathDs?: string[];
  /**
   * Layer relative to glass. Default `"behind"` (Behind Glass).
   * - behind — under glass; tint / optics apply above it
   * - inside — legacy mid-band (soft-light); prefer behind/front for new work
   * - front — Above Glass; unaffected by glass optics
   */
  layerOrder?: FrameExclusionLayerOrder;
  /** Object opacity 0–100. Default 100. */
  opacity?: number;
  /** Relative depth within its layer band 0–100 (higher draws later / closer). Default 50. */
  depth?: number;
  /** When false, skipped by the compositor but kept in the editor. Default true. */
  visible?: boolean;
  /** Optional admin notes. */
  notes?: string;
}

/**
 * Frame-level structure object inside a lens opening (Glass Occluder).
 * These are physical frame components — not glass holes.
 */
export interface FrameExclusionShape extends LensExclusionShape {
  /** @deprecated Legacy association to a lens opening id — no longer used for rendering. */
  lensId?: string;
}

/** Prefer this name in new code — same persisted `frameExclusions` JSON. */
export type GlassOccluderShape = FrameExclusionShape;

/** Resolved compositor props for one frame object (always fully populated). */
export interface ResolvedFrameExclusionObject extends FrameExclusionShape {
  layerOrder: FrameExclusionLayerOrder;
  opacity: number;
  depth: number;
  visible: boolean;
  notes: string;
  holePathDs: string[];
}

const LAYER_ORDERS = new Set<FrameExclusionLayerOrder>(["behind", "inside", "front"]);

function clampPctField(n: number | undefined, fallback: number): number {
  if (n == null || !Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

function normalizeHolePathDs(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (trimmed.length > 8) out.push(trimmed);
  }
  return out;
}

/**
 * Outer + hole subpaths as one SVG `d` string for even-odd fills.
 * Legacy single-polygon occluders (no holes) return `pathD` unchanged.
 */
export function compoundOccluderPathD(
  shape: Pick<LensExclusionShape, "pathD" | "holePathDs">,
): string {
  const outer = typeof shape.pathD === "string" ? shape.pathD.trim() : "";
  const holes = normalizeHolePathDs(shape.holePathDs);
  if (!outer) return holes.join(" ");
  if (!holes.length) return outer;
  return [outer, ...holes].join(" ");
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
    label: shape.label || "Glass occluder",
    pathD: shape.pathD,
    holePathDs: normalizeHolePathDs(shape.holePathDs),
    lensId: "lensId" in shape ? shape.lensId : undefined,
    layerOrder,
    opacity: clampPctField(shape.opacity, 100),
    depth: clampPctField(shape.depth, 50),
    visible: shape.visible !== false,
    notes: typeof shape.notes === "string" ? shape.notes : "",
  };
}

/**
 * Normalized crop rectangle on the glass sheet image (0–1 of natural width/height).
 * Full sheet when omitted or when width/height cover the image.
 */
export interface GlassSheetCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Frame-level optical / compositing settings stored on `clip_config.render`.
 * Customer tint colours still come from `sunglasses_lens_tints`; these tune how the
 * synthetic lens is painted inside the clipping polygons.
 */
export interface LensClipRenderSettings {
  /**
   * @deprecated Ignored when `glassSheetUrl` is set — a sheet is always used when present.
   * Kept for reading older presets.
   */
  glassSheetEnabled?: boolean;
  /** Public URL of the uploaded glass sheet (PNG/JPG). When set, the sheet replaces the original lens. */
  glassSheetUrl?: string | null;
  /** Natural pixel size of the sheet (captured on upload for crop/fit). */
  glassSheetNaturalWidth?: number | null;
  glassSheetNaturalHeight?: number | null;
  /** Crop of the sheet in normalized 0–1 coordinates. */
  glassSheetCrop?: GlassSheetCropRect | null;
  /** How the sheet is fitted inside each lens opening. */
  glassSheetFit?: "cover" | "contain";
  /** Extra scale after fit (1 = 100%). */
  glassSheetScale?: number;
  /** Horizontal offset inside the lens (-100 … 100). */
  glassSheetOffsetX?: number;
  /** Vertical offset inside the lens (-100 … 100). */
  glassSheetOffsetY?: number;
  /** Strength of the solid tint colour fill (0–100). */
  glassSheetColorStrength?: number;
  /** Strength of the sheet texture multiply / soft-light pass (0–100). */
  glassSheetTextureStrength?: number;
  /** Surface shine / kilau over the sheet (0–100). */
  glassSheetShine?: number;
  /**
   * When true, restore dark frame parts inside the lens hole from the product photo.
   * Default false.
   */
  glassSheetOccluderEnabled?: boolean;
  /** Occluder opacity (0–100). */
  glassSheetOccluderStrength?: number;
  /** Luminance threshold for auto occluder (0–100). Darker pixels below this are kept. */
  glassSheetOccluderThreshold?: number;

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
   * @deprecated Retired with Glass Sheet architecture — always forced off at resolve time.
   * Kept only for reading older presets.
   */
  densityGradientEnabled?: boolean;
  /** @deprecated See densityGradientEnabled. */
  densityGradientMode?: "none" | "vertical" | "horizontal" | "radial" | "angle";
  /** @deprecated See densityGradientEnabled. */
  densityGradientAngle?: number;
  /** @deprecated See densityGradientEnabled. */
  densityGradientTwoColor?: boolean;
  /** @deprecated See densityGradientEnabled. */
  densityGradientStartColor?: string | null;
  /** @deprecated See densityGradientEnabled. */
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
   * @deprecated Retired with Glass Sheet architecture — always forced to 0 at resolve time.
   * Kept only for reading older presets.
   */
  backgroundVisibility?: number;
  /**
   * @deprecated Retired with Glass Sheet architecture — always forced to 0 at resolve time.
   * Kept only for reading older presets.
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

/** Partition visible frame objects by glass layer.
 * Within each band, order follows admin list order (`depth` mirrors list index).
 */
export function partitionFrameExclusionObjects(
  objects: ResolvedFrameExclusionObject[],
): {
  behind: ResolvedFrameExclusionObject[];
  inside: ResolvedFrameExclusionObject[];
  front: ResolvedFrameExclusionObject[];
} {
  const byListOrder = (a: ResolvedFrameExclusionObject, b: ResolvedFrameExclusionObject) =>
    a.depth - b.depth || a.label.localeCompare(b.label);
  const visible = objects.filter((o) => o.visible);
  return {
    behind: visible.filter((o) => o.layerOrder === "behind").sort(byListOrder),
    inside: visible.filter((o) => o.layerOrder === "inside").sort(byListOrder),
    front: visible.filter((o) => o.layerOrder === "front").sort(byListOrder),
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
