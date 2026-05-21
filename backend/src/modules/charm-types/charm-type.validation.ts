import { z } from "zod";

export const charmTypeCreateDto = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export type CharmTypeCreateDTO = z.infer<typeof charmTypeCreateDto>;

export const charmTypeUpdateDto = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

export type CharmTypeUpdateDTO = z.infer<typeof charmTypeUpdateDto>;

export const charmTypeIdParam = z.object({
  id: z.string().uuid(),
});
