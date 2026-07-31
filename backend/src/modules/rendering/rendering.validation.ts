import { z } from "zod";

const lensExclusionShapeSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  pathD: z.string().min(8),
  holePathDs: z.array(z.string().min(8)).optional(),
  holeShapePresets: z
    .array(z.enum(["rectangle", "ellipse", "free"]).nullable())
    .optional(),
  holeBaselinePathDs: z.array(z.string().nullable()).optional(),
  shapePreset: z.enum(["rectangle", "ellipse", "free"]).optional(),
  shapeBaselinePathD: z.string().min(8).optional(),
  layerOrder: z.enum(["behind", "inside", "front"]).optional(),
  opacity: z.number().min(0).max(100).optional(),
  depth: z.number().min(0).max(100).optional(),
  visible: z.boolean().optional(),
  notes: z.string().max(500).optional(),
});

const lensClipShapeSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  pathD: z.string().min(8),
  exclusions: z.array(lensExclusionShapeSchema).optional(),
});

const frameExclusionShapeSchema = lensExclusionShapeSchema.extend({
  lensId: z.string().min(1).optional(),
});

const lensClipRenderFields = {
  renderScope: z.enum(["global", "front", "side"]).optional(),
  mode: z.enum(["replace", "overlay"]).optional(),
  automaticMaterialBehavior: z.boolean().optional(),
  tintOpacity: z.number().min(0).max(1).optional(),
  tintLayerOpacity: z.number().min(0).max(1).optional(),
  // Legacy setting written by migration v000064-era clients.
  tintFilterOpacity: z.number().min(0).max(1).optional(),
  lensOpacity: z.number().min(0).max(1).optional(),
  lensTransmission: z.number().min(0).max(1).optional(),
  frameExclusionOpacity: z.number().min(0).max(1).optional(),
  baseTintOpacity: z.number().min(0).max(1).optional(),
  transparency: z.number().min(0).max(1).optional(),
  originalLensColorInfluence: z.number().min(0).max(100).optional(),
  materialInfluence: z.number().min(0).max(100).optional(),
  // Legacy fields accepted for reading old payloads; no longer used by the renderer.
  glassMaterialStrength: z.number().min(0).max(100).optional(),
  baseBrightness: z.number().min(-100).max(100).optional(),
  baseSaturation: z.number().min(0).max(100).optional(),
  baseGamma: z.number().min(0.5).max(2.5).optional(),
  glassAbsorption: z.number().min(0).max(100).optional(),
  glassDiffusion: z.number().min(0).max(100).optional(),
  glassDepth: z.number().min(0).max(100).optional(),
  glassTintBlend: z.enum(["kaca", "color", "source-over", "multiply"]).optional(),
  glassTintShine: z.number().min(0).max(100).optional(),
  glassTintEnabled: z.boolean().optional(),
  darkLayerEnabled: z.boolean().optional(),
  darkLayerOpacity: z.number().min(0).max(100).optional(),
  darkLayerMode: z.enum(["flat", "gradasi"]).optional(),
  darkLayerColor: z.string().min(4).max(9).optional(),
  darkLayerBlend: z.enum(["source-over", "multiply"]).optional(),
  darkLayerGlow: z.number().min(0).max(100).optional(),
  darkLayerGlowSize: z.number().min(0).max(100).optional(),
  darkLayerGlowX: z.number().min(0).max(100).optional(),
  darkLayerGlowY: z.number().min(0).max(100).optional(),
  darkLayerSoft: z.number().min(0).max(100).optional(),
  darkLayerEdge: z.number().min(0).max(100).optional(),
  glassSheetEnabled: z.boolean().optional(),
  glassCompositionOrder: z.enum(["hybrid", "under-frame", "over-surface"]).optional(),
  glassBaseSource: z.enum(["sheet", "canvas"]).optional(),
  glassDebugStage: z.enum(["original", "glass-base", "glass-tint", "full"]).optional(),
  glassSheetUrl: z.string().nullable().optional(),
  glassSheetNaturalWidth: z.number().min(1).nullable().optional(),
  glassSheetNaturalHeight: z.number().min(1).nullable().optional(),
  glassSheetCrop: z
    .object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      width: z.number().min(0.01).max(1),
      height: z.number().min(0.01).max(1),
    })
    .nullable()
    .optional(),
  glassSheetFit: z.enum(["cover", "contain"]).optional(),
  glassSheetScale: z.number().min(0.25).max(3).optional(),
  glassSheetOffsetX: z.number().min(-100).max(100).optional(),
  glassSheetOffsetY: z.number().min(-100).max(100).optional(),
  glassSheetColorStrength: z.number().min(0).max(100).optional(),
  glassSheetTextureStrength: z.number().min(0).max(100).optional(),
  glassSheetShine: z.number().min(0).max(100).optional(),
  glassSheetOccluderEnabled: z.boolean().optional(),
  glassSheetOccluderStrength: z.number().min(0).max(100).optional(),
  glassSheetOccluderThreshold: z.number().min(0).max(100).optional(),
  innerFrameEnabled: z.boolean().optional(),
  innerFrameThickness: z.number().min(0).max(8).optional(),
  innerFrameOpacity: z.number().min(0).max(100).optional(),
  innerFrameFeather: z.number().min(0).max(100).optional(),
  innerFrameBlendMode: z.enum(["normal", "multiply", "overlay", "screen"]).optional(),
  edgeEnabled: z.boolean().optional(),
  densityGradientEnabled: z.boolean().optional(),
  densityGradientMode: z.enum(["none", "vertical", "horizontal", "radial", "angle"]).optional(),
  densityGradientAngle: z.number().min(0).max(360).optional(),
  densityGradientTwoColor: z.boolean().optional(),
  densityGradientStartColor: z.string().min(4).max(9).nullable().optional(),
  densityGradientEndColor: z.string().min(4).max(9).nullable().optional(),
  densityGradientStrength: z.number().min(0).max(100).optional(),
  densityGradientSoftness: z.number().min(0).max(100).optional(),
  densityGradientPosition: z.number().min(0).max(100).optional(),
  densityGradientStartFalloff: z.number().min(0).max(100).optional(),
  densityGradientEndFalloff: z.number().min(0).max(100).optional(),
  densityGradientCurve: z.enum(["linear", "ease-in", "ease-out", "ease-in-out"]).optional(),
  brightness: z.number().min(0.25).max(2).optional(),
  contrast: z.number().min(0).max(2).optional(),
  saturation: z.number().min(0).max(2).optional(),
  gradientEnabled: z.boolean().optional(),
  gradientTopColor: z.string().min(4).max(9).nullable().optional(),
  gradientBottomColor: z.string().min(4).max(9).nullable().optional(),
  gradientPosition: z.number().min(0).max(100).optional(),
  gradientStrength: z.number().min(0).max(1).optional(),
  reflectionEnabled: z.boolean().optional(),
  reflectionStrength: z.number().min(0).max(1).optional(),
  reflectionOpacity: z.number().min(0).max(1).optional(),
  reflectionAngle: z.number().min(0).max(360).optional(),
  reflectionBlur: z.number().min(0).max(1).optional(),
  reflectionPosition: z.number().min(-100).max(100).optional(),
  reflectionOffsetX: z.number().min(-100).max(100).optional(),
  reflectionOffsetY: z.number().min(-100).max(100).optional(),
  reflectionScale: z.number().min(0.5).max(1.75).optional(),
  mirrorReflection: z.boolean().optional(),
  reflectionRightAngle: z.number().min(0).max(360).optional(),
  reflectionRightOffsetX: z.number().min(-100).max(100).optional(),
  reflectionRightOffsetY: z.number().min(-100).max(100).optional(),
  reflectionRightScale: z.number().min(0.5).max(1.75).optional(),
  reflectionRightOpacity: z.number().min(0).max(1).optional(),
  reflectionRightBlur: z.number().min(0).max(1).optional(),
  baseGlassDarkness: z.number().min(0).max(100).optional(),
  baseGlassRichness: z.number().min(0).max(100).optional(),
  baseGlassNeutralization: z.number().min(0).max(100).optional(),
  /** @deprecated Prefer baseGlassDarkness. */
  glassBaseDensity: z.number().min(0).max(100).optional(),
  /** @deprecated Prefer baseGlassRichness. */
  baseDensityBias: z.number().min(0).max(100).optional(),
  internalReflectionEnabled: z.boolean().optional(),
  internalReflectionOpacity: z.number().min(0).max(1).optional(),
  internalReflectionSoftness: z.number().min(0).max(1).optional(),
  internalReflectionScale: z.number().min(0.5).max(1.75).optional(),
  internalReflectionAngle: z.number().min(0).max(360).optional(),
  fresnelEnabled: z.boolean().optional(),
  fresnelStrength: z.number().min(0).max(1).optional(),
  fresnelWidth: z.number().min(0).max(1).optional(),
  fresnelSoftness: z.number().min(0).max(1).optional(),
  glossEnabled: z.boolean().optional(),
  glossIntensity: z.number().min(0).max(1).optional(),
  glossStrength: z.number().min(0).max(1).optional(),
  vignetteEnabled: z.boolean().optional(),
  vignetteStrength: z.number().min(0).max(1).optional(),
  edgeFade: z.number().min(0).max(1).optional(),
  edgeDarkness: z.number().min(0).max(1).optional(),
  edgeWidth: z.number().min(0).max(0.05).optional(),
  backgroundVisibility: z.number().min(0).max(1).optional(),
  environmentTransparency: z.number().min(0).max(1).optional(),
  centerDensity: z.number().min(0).max(1).optional(),
  edgeDensity: z.number().min(0).max(1).optional(),
  edgeSoftness: z.number().min(0).max(1).optional(),
  edgeOpacity: z.number().min(0).max(1).optional(),
  polarizedEnabled: z.boolean().optional(),
  polarizedStrength: z.number().min(0).max(1).optional(),
  // Legacy overlay fields
  tintBlendMode: z.enum(["multiply", "screen", "overlay", "color", "soft-light"]).optional(),
  highlightStrength: z.number().min(0).max(1).optional(),
  highlightBlendMode: z.enum(["screen", "overlay", "soft-light"]).optional(),
  shadowStrength: z.number().min(0).max(1).optional(),
};

/** Non-optional object schema for preset settings JSON. */
export const lensClipRenderSettingsSchema = z.object(lensClipRenderFields);

const lensClipRenderSchema = lensClipRenderSettingsSchema.optional();

const pathAnchorSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  curved: z.boolean().optional(),
  handleIn: z.object({ x: z.number(), y: z.number() }).nullable().optional(),
  handleOut: z.object({ x: z.number(), y: z.number() }).nullable().optional(),
});

const lensPolygonSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  points: z.array(pathAnchorSchema),
  layerOrder: z.enum(["behind", "inside", "front"]).optional(),
  opacity: z.number().min(0).max(100).optional(),
  depth: z.number().min(0).max(100).optional(),
  visible: z.boolean().optional(),
  notes: z.string().max(500).optional(),
  shapePreset: z.enum(["rectangle", "ellipse", "free"]).optional(),
  shapeBaseline: z.array(pathAnchorSchema).optional(),
  holes: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string(),
        points: z.array(pathAnchorSchema),
        shapePreset: z.enum(["rectangle", "ellipse", "free"]).optional(),
        shapeBaseline: z.array(pathAnchorSchema).optional(),
      }),
    )
    .optional(),
});

export const maskConfigSchema = z.object({
  version: z.literal(2),
  imageWidth: z.number().int().positive(),
  imageHeight: z.number().int().positive(),
  lenses: z.array(lensPolygonSchema).min(1),
  // Canonical frame-level exclusions (independent of left/right).
  frameExclusions: z.array(lensPolygonSchema).optional(),
  // Legacy by-side exclusions, read for backward compatibility only.
  exclusions: z
    .object({
      left: z.array(lensPolygonSchema).optional(),
      right: z.array(lensPolygonSchema).optional(),
    })
    .optional(),
  updatedAt: z.number().optional(),
});

export const lensClipConfigSchema = z.object({
  version: z.literal(1),
  imageWidth: z.number().int().positive(),
  imageHeight: z.number().int().positive(),
  lenses: z.array(lensClipShapeSchema).min(1),
  frameExclusions: z.array(frameExclusionShapeSchema).optional(),
  render: lensClipRenderSchema,
  updatedAt: z.number().optional(),
});

const beadNormPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

const beadPathAnchorSchema = beadNormPointSchema.extend({
  curved: z.boolean().optional(),
  handleIn: beadNormPointSchema.nullable().optional(),
  handleOut: beadNormPointSchema.nullable().optional(),
});

const beadCropRectSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

/** Frame plate path crop — BeadCropConfig v1 (rect) or v2 (path). */
export const beadCropConfigSchema = z.union([
  z.object({
    version: z.literal(1),
    imageWidth: z.number().int().positive(),
    imageHeight: z.number().int().positive(),
    originalUrl: z.string().min(1),
    processedUrl: z.string().optional(),
    crop: beadCropRectSchema,
    scale: z.number(),
    shape: z.enum(["circle", "rect"]),
    autoDetected: z.boolean().optional(),
    updatedAt: z.number().optional(),
  }),
  z.object({
    version: z.literal(2),
    imageWidth: z.number().int().positive(),
    imageHeight: z.number().int().positive(),
    originalUrl: z.string().min(1),
    processedUrl: z.string().optional(),
    points: z.array(beadPathAnchorSchema).min(3),
    scale: z.number(),
    updatedAt: z.number().optional(),
    detection: z
      .object({
        autoDetected: z.boolean().optional(),
        confidence: z.number().optional(),
        contourPointCount: z.number().optional(),
        pathPointCount: z.number().optional(),
        curvedSegmentCount: z.number().optional(),
      })
      .optional(),
  }),
]);

export const upsertFrameViewSchema = z.object({
  plateUrl: z.string().min(1),
  imageWidth: z.coerce.number().int().positive(),
  imageHeight: z.coerce.number().int().positive(),
  originalPlateUrl: z.string().min(1).optional(),
  originalImageWidth: z.coerce.number().int().positive().optional(),
  originalImageHeight: z.coerce.number().int().positive().optional(),
  plateCropConfig: beadCropConfigSchema.nullable().optional(),
  clipConfig: lensClipConfigSchema.nullable().optional(),
  clipStatus: z.enum(["draft", "ready"]).optional(),
  /** Editor anchors/handles — persisted for lossless re-edit */
  maskConfig: maskConfigSchema.nullable().optional(),
  maskStatus: z.enum(["draft", "ready"]).optional(),
});

export type UpsertFrameViewDTO = z.infer<typeof upsertFrameViewSchema>;

export const viewAxisParamSchema = z.enum(["front", "side", "three_quarter"]);

export const frameIdParam = z.object({
  frameId: z.string().uuid(),
});

export const frameViewParams = frameIdParam.extend({
  viewAxis: viewAxisParamSchema,
});

export const frameBatchQuerySchema = z.object({
  ids: z
    .string()
    .min(1)
    .transform((raw) =>
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().uuid()).min(1).max(24)),
});

export const validateClipBodySchema = z.object({
  clipConfig: z.unknown(),
});
