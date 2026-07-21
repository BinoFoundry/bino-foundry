import { z } from "zod";

const lensExclusionShapeSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  pathD: z.string().min(8),
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
  tintOpacity: z.number().min(0).max(1).optional(),
  tintLayerOpacity: z.number().min(0).max(1).optional(),
  // Legacy setting written by migration v000064-era clients.
  tintFilterOpacity: z.number().min(0).max(1).optional(),
  lensOpacity: z.number().min(0).max(1).optional(),
  lensTransmission: z.number().min(0).max(1).optional(),
  frameExclusionOpacity: z.number().min(0).max(1).optional(),
  baseTintOpacity: z.number().min(0).max(1).optional(),
  transparency: z.number().min(0).max(1).optional(),
  brightness: z.number().min(0.25).max(2).optional(),
  contrast: z.number().min(0).max(2).optional(),
  saturation: z.number().min(0).max(2).optional(),
  gradientEnabled: z.boolean().optional(),
  gradientTopColor: z.string().min(4).max(9).optional(),
  gradientBottomColor: z.string().min(4).max(9).optional(),
  gradientPosition: z.number().min(0).max(100).optional(),
  gradientStrength: z.number().min(0).max(1).optional(),
  reflectionEnabled: z.boolean().optional(),
  reflectionStrength: z.number().min(0).max(1).optional(),
  reflectionOpacity: z.number().min(0).max(1).optional(),
  reflectionAngle: z.number().min(0).max(360).optional(),
  reflectionBlur: z.number().min(0).max(1).optional(),
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
