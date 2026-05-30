import { z } from "zod";

const beadSizeMm = z.number().int().min(4).max(24);

export const braceletConfigItemDto = z.object({
  strandIndex: z.union([z.literal(0), z.literal(1)]),
  slotPosition: z.number().int().min(0),
  beadLibraryId: z.string().min(1),
  beadSizeMm: beadSizeMm,
});

export const createBraceletConfigDto = z
  .object({
    twinning: z.boolean().optional(),
    wristSizeCmA: z.number().min(14).max(24),
    wristSizeCmB: z.number().min(14).max(24).optional(),
    defaultBeadSizeMm: beadSizeMm.optional(),
    items: z.array(braceletConfigItemDto).min(1),
    status: z.enum(["draft", "saved"]).optional(),
  })
  .transform((v) => ({
    twinning: v.twinning ?? false,
    wristSizeCmA: v.wristSizeCmA,
    wristSizeCmB: v.wristSizeCmB ?? 16,
    defaultBeadSizeMm: (v.defaultBeadSizeMm ?? 8) as 6 | 8 | 10,
    items: v.items,
    status: (v.status ?? "saved") as "draft" | "saved",
  }));

export const braceletConfigIdParam = z.object({
  id: z.string().min(1),
});

export type CreateBraceletConfigDTO = {
  twinning: boolean;
  wristSizeCmA: number;
  wristSizeCmB: number;
  defaultBeadSizeMm: 6 | 8 | 10;
  items: z.infer<typeof braceletConfigItemDto>[];
  status: "draft" | "saved";
};
