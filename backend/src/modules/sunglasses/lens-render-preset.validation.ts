import { z } from "zod";

import { lensClipRenderSettingsSchema } from "../rendering/rendering.validation.js";

export const lensRenderPresetIdParam = z.object({ id: z.string().uuid() });

const presetFields = {
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(""),
  settings: lensClipRenderSettingsSchema.default({}),
  displayOrder: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
};

export const lensRenderPresetCreateDto = z.object(presetFields);

export const lensRenderPresetUpdateDto = z
  .object({
    code: presetFields.code.optional(),
    name: presetFields.name.optional(),
    description: z.string().trim().max(500).optional(),
    settings: lensClipRenderSettingsSchema.optional(),
    displayOrder: z.number().int().nonnegative().optional(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
  })
  .strict();

export type LensRenderPresetCreateDTO = z.input<typeof lensRenderPresetCreateDto>;
export type LensRenderPresetUpdateDTO = z.infer<typeof lensRenderPresetUpdateDto>;
