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
    title: z.string().trim().min(1).max(120).optional(),
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

export type SaveDesignDTO = z.infer<typeof saveDesignDto>;
export type SunglassesConfigDTO = z.infer<typeof sunglassesConfigDto>;
