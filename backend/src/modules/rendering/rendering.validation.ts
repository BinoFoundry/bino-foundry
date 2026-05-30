import { z } from "zod";

const lensClipShapeSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  pathD: z.string().min(8),
});

const lensClipRenderSchema = z
  .object({
    lensOpacity: z.number().min(0).max(1).optional(),
    tintBlendMode: z.enum(["multiply", "screen", "overlay", "color"]).optional(),
    highlightStrength: z.number().min(0).max(1).optional(),
    highlightBlendMode: z.enum(["screen", "overlay", "soft-light"]).optional(),
    shadowStrength: z.number().min(0).max(1).optional(),
  })
  .optional();

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
  updatedAt: z.number().optional(),
});

export const lensClipConfigSchema = z.object({
  version: z.literal(1),
  imageWidth: z.number().int().positive(),
  imageHeight: z.number().int().positive(),
  lenses: z.array(lensClipShapeSchema).min(1),
  render: lensClipRenderSchema,
  updatedAt: z.number().optional(),
});

export const upsertFrameViewSchema = z.object({
  plateUrl: z.string().min(1),
  imageWidth: z.coerce.number().int().positive(),
  imageHeight: z.coerce.number().int().positive(),
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
