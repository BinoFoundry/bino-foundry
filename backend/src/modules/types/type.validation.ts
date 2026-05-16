import { z } from "zod";

export const typeCreateDto = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export type TypeCreateDTO = z.infer<typeof typeCreateDto>;

export const typeUpdateDto = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

export type TypeUpdateDTO = z.infer<typeof typeUpdateDto>;

export const typeIdParam = z.object({
  id: z.string().uuid(),
});
