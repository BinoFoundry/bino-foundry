import { z } from "zod";

const beadSizeMm = z.number().int().min(4).max(24);

export const braceletPricingRulesDto = z.object({
  sizeMultipliers: z
    .record(z.string().regex(/^\d+$/), z.number().positive())
    .refine((m) => Object.keys(m).length > 0, "At least one size multiplier is required"),
  sizePricedTypeSlugs: z.array(z.string().trim().min(1)).min(1),
  currencyCode: z.string().length(3).toUpperCase(),
  description: z.string().max(2000).optional(),
});

export const braceletPricingRulesResponse = braceletPricingRulesDto;

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
