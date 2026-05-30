import { z } from "zod";

import { lensClipConfigSchema, maskConfigSchema } from "../rendering/rendering.validation.js";

const lensColorSchema = z.object({
  colorName: z.string().min(1),
  image: z.string().min(1),
});

const renderViewSchema = z.object({
  view: z.enum(["front", "side", "three_quarter"]),
  plateUrl: z.string().min(1),
  width: z.coerce.number().int().positive(),
  height: z.coerce.number().int().positive(),
  clipConfig: lensClipConfigSchema.nullable().optional(),
  clipStatus: z.enum(["draft", "ready"]).optional(),
  /** Editor anchors/handles — persisted alongside clip_config for re-edit */
  maskConfig: maskConfigSchema.nullable().optional(),
  maskStatus: z.enum(["draft", "ready"]).optional(),
});

export const frameCreateDto = z.object({
  name: z.string().min(1),
  price: z.coerce.number().nonnegative(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.coerce.number().int().optional(),
  frameImages: z.array(z.string()).optional(),
  lensColors: z.array(lensColorSchema).optional(),
  renderViews: z.array(renderViewSchema).optional(),
});

export type FrameCreateDTO = z.infer<typeof frameCreateDto>;

export const frameUpdateDto = frameCreateDto.partial();

export type FrameUpdateDTO = z.infer<typeof frameUpdateDto>;

export const frameIdParam = z.object({
  id: z.string().uuid(),
});
