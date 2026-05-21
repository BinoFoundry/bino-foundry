import { z } from "zod";

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

export const upsertFrameViewSchema = z.object({
  plateUrl: z.string().url(),
  imageWidth: z.number().int().positive(),
  imageHeight: z.number().int().positive(),
  maskConfig: maskConfigSchema.nullable().optional(),
  maskStatus: z.enum(["draft", "ready"]).optional(),
});

export type UpsertFrameViewDTO = z.infer<typeof upsertFrameViewSchema>;

export const viewAxisParamSchema = z.enum(["front", "side"]);

export const frameIdParam = z.object({
  frameId: z.string().uuid(),
});

export const frameViewParams = frameIdParam.extend({
  viewAxis: viewAxisParamSchema,
});
