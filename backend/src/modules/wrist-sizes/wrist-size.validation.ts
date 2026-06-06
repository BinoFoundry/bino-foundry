import { z } from "zod";

export const wristSizeIdParam = z.object({ id: z.string().uuid() });

export const createWristSizeDto = z.object({
  sizeCm: z.number().positive().max(50),
  label: z.string().min(1).max(64),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  notes: z.string().max(500).optional().nullable(),
});

export const updateWristSizeDto = createWristSizeDto.partial();

export type WristSizeCreateDTO = z.infer<typeof createWristSizeDto>;
export type WristSizeUpdateDTO = z.infer<typeof updateWristSizeDto>;
