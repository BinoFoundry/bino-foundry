import { z } from "zod";

export const beadSizeIdParam = z.object({ id: z.string().uuid() });

export const createBeadSizeDto = z.object({
  sizeMm: z.number().int().min(4).max(24),
  label: z.string().min(1).max(32),
  priceMultiplier: z.number().positive().max(10),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export const updateBeadSizeDto = createBeadSizeDto.partial();

export type BeadSizeCreateDTO = z.infer<typeof createBeadSizeDto>;
export type BeadSizeUpdateDTO = z.infer<typeof updateBeadSizeDto>;
