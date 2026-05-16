import { z } from "zod";

const lensColorSchema = z.object({
  colorName: z.string().min(1),
  image: z.string().min(1),
});

export const frameCreateDto = z.object({
  name: z.string().min(1),
  price: z.number().nonnegative(),
  description: z.string().optional(),
  frameImages: z.array(z.string()).optional(),
  lensColors: z.array(lensColorSchema).optional(),
});

export type FrameCreateDTO = z.infer<typeof frameCreateDto>;

export const frameUpdateDto = frameCreateDto.partial();

export type FrameUpdateDTO = z.infer<typeof frameUpdateDto>;

export const frameIdParam = z.object({
  id: z.string().uuid(),
});
