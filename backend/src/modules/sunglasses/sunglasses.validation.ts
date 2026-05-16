import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Expected #RRGGBB hex colour");
const tintCategory = z.enum(["classic", "gradient"]);

export const lensTintIdParam = z.object({ id: z.string().uuid() });
export const builderOptionIdParam = z.object({ id: z.string().uuid() });
export const frameColorIdParam = z.object({ id: z.string().uuid() });

const lensTintFields = {
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(120),
  category: tintCategory,
  gradientTop: hexColor,
  gradientBottom: hexColor,
  priceSurcharge: z.number().nonnegative(),
  displayOrder: z.number().int().nonnegative(),
  isActive: z.boolean(),
};

export const lensTintCreateDto = z.object({
  ...lensTintFields,
  priceSurcharge: lensTintFields.priceSurcharge.default(0),
  displayOrder: lensTintFields.displayOrder.default(0),
  isActive: lensTintFields.isActive.default(true),
});

export const lensTintUpdateDto = z.object(lensTintFields).partial();

const builderOptionFields = {
  code: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500),
  priceSurcharge: z.number().nonnegative(),
  requiresManualFollowUp: z.boolean(),
  tooltipText: z.string().trim().max(500).nullable(),
  displayOrder: z.number().int().nonnegative(),
  isActive: z.boolean(),
};

export const builderOptionCreateDto = z.object({
  code: builderOptionFields.code,
  label: builderOptionFields.label,
  description: builderOptionFields.description.default(""),
  priceSurcharge: builderOptionFields.priceSurcharge.default(0),
  requiresManualFollowUp: builderOptionFields.requiresManualFollowUp.default(false),
  tooltipText: builderOptionFields.tooltipText.optional(),
  displayOrder: builderOptionFields.displayOrder.default(0),
  isActive: builderOptionFields.isActive.default(true),
});

export const builderOptionUpdateDto = z
  .object({
    code: builderOptionFields.code.optional(),
    label: builderOptionFields.label.optional(),
    description: builderOptionFields.description.optional(),
    priceSurcharge: builderOptionFields.priceSurcharge.optional(),
    requiresManualFollowUp: builderOptionFields.requiresManualFollowUp.optional(),
    tooltipText: builderOptionFields.tooltipText.optional(),
    displayOrder: builderOptionFields.displayOrder.optional(),
    isActive: builderOptionFields.isActive.optional(),
  });

const frameColorFields = {
  name: z.string().trim().min(1).max(80),
  hex: hexColor,
  displayOrder: z.number().int().nonnegative(),
  isActive: z.boolean(),
};

export const frameColorCreateDto = z.object({
  name: frameColorFields.name,
  hex: frameColorFields.hex,
  displayOrder: frameColorFields.displayOrder.default(0),
  isActive: frameColorFields.isActive.default(true),
});

export const frameColorUpdateDto = z.object(frameColorFields).partial();

export type LensTintCreateDTO = z.input<typeof lensTintCreateDto>;
export type LensTintUpdateDTO = z.infer<typeof lensTintUpdateDto>;
export type BuilderOptionCreateDTO = z.input<typeof builderOptionCreateDto>;
export type BuilderOptionUpdateDTO = z.infer<typeof builderOptionUpdateDto>;
export type FrameColorCreateDTO = z.input<typeof frameColorCreateDto>;
export type FrameColorUpdateDTO = z.infer<typeof frameColorUpdateDto>;
