import { z } from "zod";

const lensColorSchema = z.object({
  colorName: z.string().min(1),
  image: z.string().min(1),
});

const renderViewSchema = z.object({
  view: z.enum(["front", "side"]),
  plateUrl: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  maskConfig: z.record(z.unknown()).nullable().optional(),
  maskStatus: z.enum(["draft", "ready"]).optional(),
});

export const frameCreateDto = z.object({
  name: z.string().min(1),
  price: z.number().nonnegative(),
  description: z.string().optional(),
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
