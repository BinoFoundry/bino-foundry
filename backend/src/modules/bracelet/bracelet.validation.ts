import { z } from "zod";

import { beadSizeMmSchema } from "../../lib/bead-size-mm.js";

const beadSizeMm = beadSizeMmSchema;

export const braceletConfigItemDto = z
  .object({
    strandIndex: z.union([z.literal(0), z.literal(1)]),
    slotPosition: z.number().int().min(0),
    beadLibraryId: z.string().min(1),
    beadSizeMm: beadSizeMm,
    /** @deprecated Use beadLibraryId + beadSizeMm — accepted for older clients. */
    beadVariantId: z.string().min(1).optional(),
  })
  .transform((item) => ({
    ...item,
    beadSizeMm:
      item.beadSizeMm ??
      (item.beadVariantId?.match(/-(\d+)$/)?.[1]
        ? Number(item.beadVariantId.match(/-(\d+)$/)![1])
        : undefined),
  }))
  .refine((item) => item.beadSizeMm !== undefined, {
    message: "beadSizeMm is required",
  });

export const createBraceletConfigDto = z
  .object({
    twinning: z.boolean().optional(),
    wristSizeCmA: z.number().positive().max(50),
    wristSizeCmB: z.number().positive().max(50).optional(),
    defaultBeadSizeMm: beadSizeMm.optional(),
    items: z.array(braceletConfigItemDto).min(1),
    status: z.enum(["draft", "saved"]).optional(),
  })
  .transform((v) => ({
    twinning: v.twinning ?? false,
    wristSizeCmA: v.wristSizeCmA,
    wristSizeCmB: v.wristSizeCmB ?? 16,
    defaultBeadSizeMm: v.defaultBeadSizeMm ?? null,
    items: v.items,
    status: (v.status ?? "saved") as "draft" | "saved",
  }));

export const braceletConfigIdParam = z.object({
  id: z.string().min(1),
});

export const updateBraceletStatusDto = z.object({
  status: z.enum(["saved", "ordered", "archived"]),
  orderReference: z.string().trim().min(1).max(128).optional(),
});

export type CreateBraceletConfigDTO = {
  twinning: boolean;
  wristSizeCmA: number;
  wristSizeCmB: number;
  defaultBeadSizeMm: number | null;
  items: z.infer<typeof braceletConfigItemDto>[];
  status: "draft" | "saved";
};
