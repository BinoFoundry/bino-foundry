import { z } from "zod";

const sizeMm = z.number().int().min(4).max(24);

export const beadVariantIdParam = z.object({
  id: z.string().min(1),
});

export const createBeadVariantDto = z.object({
  publicId: z.string().trim().min(1),
  beadLibraryId: z.string().trim().min(1),
  sizeMm: sizeMm,
  unitPrice: z.number().min(0),
  label: z.string().trim().min(1),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export const updateBeadVariantDto = createBeadVariantDto.partial().omit({ publicId: true, beadLibraryId: true });

export type BeadVariantCreateDTO = z.infer<typeof createBeadVariantDto>;
export type BeadVariantUpdateDTO = z.infer<typeof updateBeadVariantDto>;
