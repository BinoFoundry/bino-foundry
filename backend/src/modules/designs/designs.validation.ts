import { z } from "zod";

import { beadSizeMmSchema } from "../../lib/bead-size-mm.js";
import { createBraceletConfigDto } from "../bracelet/bracelet.validation.js";

const builderStepSchema = z.enum(["frame", "lens", "rx", "extras", "preview"]);

export const sunglassesConfigDto = z.object({
  frameId: z.string().uuid(),
  lensTintId: z.string().uuid(),
  selectedOptions: z.record(z.string(), z.boolean()).default({}),
  builderStep: builderStepSchema.optional(),
  subtotal: z.number().nonnegative().optional(),
  currencyCode: z.string().length(3).optional(),
});

export const saveDesignDto = z
  .object({
    productType: z.enum(["bracelet", "sunglasses"]),
    title: z.string().trim().max(120).optional(),
    status: z.enum(["draft", "saved"]).optional(),
    designId: z.string().min(1).optional(),
    previewThumbnailDataUrl: z.string().max(700_000).optional(),
    bracelet: createBraceletConfigDto.optional(),
    sunglasses: sunglassesConfigDto.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.productType === "bracelet" && !value.bracelet) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "bracelet configuration is required" });
    }
    if (value.productType === "sunglasses" && !value.sunglasses) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "sunglasses configuration is required" });
    }
  });

export const designIdParam = z.object({
  id: z.string().min(1),
});

/** Bulk delete payload — public design ids (`dsn_…`). Accepts camelCase or snake_case. */
export const bulkDeleteDesignsDto = z
  .object({
    designIds: z.array(z.string().min(1)).min(1).max(100).optional(),
    design_ids: z.array(z.string().min(1)).min(1).max(100).optional(),
  })
  .superRefine((value, ctx) => {
    const ids = value.designIds ?? value.design_ids;
    if (!ids?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "designIds is required",
        path: ["designIds"],
      });
    }
  })
  .transform((value) => {
    const raw = value.designIds ?? value.design_ids ?? [];
    const seen = new Set<string>();
    const designIds: string[] = [];
    for (const id of raw) {
      const trimmed = id.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      designIds.push(trimmed);
    }
    return { designIds };
  });

export type SaveDesignDTO = z.infer<typeof saveDesignDto>;
export type SunglassesConfigDTO = z.infer<typeof sunglassesConfigDto>;
export type BulkDeleteDesignsDTO = z.infer<typeof bulkDeleteDesignsDto>;
