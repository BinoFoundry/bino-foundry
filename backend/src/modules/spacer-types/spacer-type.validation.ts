import { z } from "zod";

export const spacerTypeCreateDto = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export type SpacerTypeCreateDTO = z.infer<typeof spacerTypeCreateDto>;

export const spacerTypeUpdateDto = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

export type SpacerTypeUpdateDTO = z.infer<typeof spacerTypeUpdateDto>;

export const spacerTypeIdParam = z.object({
  id: z.string().uuid(),
});
