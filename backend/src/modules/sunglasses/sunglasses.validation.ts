import { GRADIENT_DIRECTIONS, LENS_TINT_CATEGORIES } from "@bino-foundry/shared/types";
import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Expected #RRGGBB hex colour");
const tintCategory = z.enum(LENS_TINT_CATEGORIES);
const gradientDirection = z.enum(GRADIENT_DIRECTIONS);

export const lensTintIdParam = z.object({ id: z.string().uuid() });
export const builderOptionIdParam = z.object({ id: z.string().uuid() });
const lensTintFields = {
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(120),
  category: tintCategory,
  gradientTop: hexColor,
  gradientBottom: hexColor,
  opacity: z.number().min(0.05).max(1),
  gradientDirection: gradientDirection,
  gradientAngle: z.number().int().min(0).max(359),
  gradientMidPosition: z.number().int().min(0).max(100),
  gradientIntensity: z.number().min(0).max(1),
  priceSurcharge: z.number().nonnegative(),
  displayOrder: z.number().int().nonnegative(),
  isActive: z.boolean(),
};

export const lensTintCreateDto = z.object({
  ...lensTintFields,
  opacity: lensTintFields.opacity.default(0.58),
  gradientDirection: lensTintFields.gradientDirection.default("top-to-bottom"),
  gradientAngle: lensTintFields.gradientAngle.default(180),
  gradientMidPosition: lensTintFields.gradientMidPosition.default(50),
  gradientIntensity: lensTintFields.gradientIntensity.default(0.55),
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

export type LensTintCreateDTO = z.input<typeof lensTintCreateDto>;
export type LensTintUpdateDTO = z.infer<typeof lensTintUpdateDto>;
export type BuilderOptionCreateDTO = z.input<typeof builderOptionCreateDto>;
export type BuilderOptionUpdateDTO = z.infer<typeof builderOptionUpdateDto>;
