import { z } from "zod";

export const beadLibraryIdParam = z.object({
  id: z.string().min(1),
});

export const syncLibrarySizesDto = z.object({
  sizes: z
    .array(
      z.object({
        sizeMm: z.number().int().min(4).max(24),
        unitPrice: z.number().min(0),
        isDefault: z.boolean().optional(),
      }),
    )
    .min(0),
});

export type SyncLibrarySizesDTO = z.infer<typeof syncLibrarySizesDto>;
