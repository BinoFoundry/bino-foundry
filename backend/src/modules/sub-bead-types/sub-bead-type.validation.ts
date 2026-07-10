import { z } from "zod";

export const subBeadTypeIdParam = z.object({ id: z.string().uuid() });

export const createSubBeadTypeDto = z.object({
  beadTypeId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateSubBeadTypeDto = createSubBeadTypeDto.partial();

export type SubBeadTypeCreateDTO = z.infer<typeof createSubBeadTypeDto>;
export type SubBeadTypeUpdateDTO = z.infer<typeof updateSubBeadTypeDto>;
