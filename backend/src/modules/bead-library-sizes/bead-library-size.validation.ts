import { z } from "zod";

import { beadSizeMmSchema } from "../../lib/bead-size-mm.js";

export const beadLibraryIdParam = z.object({
  id: z.string().min(1),
});

export const syncLibrarySizesDto = z.object({
  sizes: z
    .array(
      z.object({
        sizeMm: beadSizeMmSchema,
        unitPrice: z.coerce.number().min(0),
        isDefault: z.boolean().optional(),
      }),
    )
    .min(0),
});

export type SyncLibrarySizesDTO = z.infer<typeof syncLibrarySizesDto>;
