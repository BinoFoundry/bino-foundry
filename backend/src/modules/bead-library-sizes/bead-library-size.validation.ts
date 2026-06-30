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
  skipNormalization: z.boolean().optional(),
  force: z.boolean().optional(),
});

const deliveryUrlsDto = z
  .object({
    png: z.string().url().optional(),
    webp: z.string().url().optional(),
    avif: z.string().url().optional(),
  })
  .optional();

export const saveNormalizedExportsDto = z.object({
  exports: z
    .array(
      z.object({
        sizeMm: beadSizeMmSchema,
        normalizedProcessedImageUrl: z.string().url(),
        normalizedDeliveryUrls: deliveryUrlsDto,
        normalizedVisibleDiameterPx: z.coerce.number().positive(),
      }),
    )
    .min(1),
});

export type SyncLibrarySizesDTO = z.infer<typeof syncLibrarySizesDto>;
export type SaveNormalizedExportsDTO = z.infer<typeof saveNormalizedExportsDto>;
