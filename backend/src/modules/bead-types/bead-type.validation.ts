import { z } from "zod";

export const beadTypeCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  usesSizePricing: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const beadTypeUpdateSchema = beadTypeCreateSchema.partial();

export const createBeadTypeDto = beadTypeCreateSchema;
export const updateBeadTypeDto = beadTypeUpdateSchema;
export const beadTypeIdParam = z.object({ id: z.string().uuid() });

export type BeadTypeCreateDTO = z.infer<typeof createBeadTypeDto>;
export type BeadTypeUpdateDTO = z.infer<typeof updateBeadTypeDto>;
