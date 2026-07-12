import { z } from "zod";

const benefitsSchema = z.array(z.string().trim().min(1));

const howWePrepareOptionBaseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens"),
  shortDescription: z.string().trim().max(500).default(""),
  fullDescription: z.string().trim().max(4000).default(""),
  optionType: z.string().trim().min(1).max(40).default("preparation"),
  priceType: z.enum(["fixed", "per_bracelet", "per_quantity"]).default("fixed"),
  price: z.number().min(0).default(0),
  priceLabel: z.string().trim().max(80).default(""),
  defaultQuantity: z.number().int().min(1).default(1),
  minimumQuantity: z.number().int().min(1).default(1),
  maximumQuantity: z.number().int().min(1).default(1),
  quantityEnabled: z.boolean().default(false),
  benefits: benefitsSchema.default([]),
  highlightTitle: z.string().trim().max(200).default(""),
  highlightDescription: z.string().trim().max(2000).default(""),
  badge: z.string().trim().max(40).nullable().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
  sortOrder: z.number().int().min(0).default(0),
});

export const createHowWePrepareOptionDto = howWePrepareOptionBaseSchema
  .refine((v) => v.minimumQuantity <= v.maximumQuantity, {
    message: "minimumQuantity must be <= maximumQuantity",
    path: ["minimumQuantity"],
  })
  .refine((v) => v.defaultQuantity >= v.minimumQuantity && v.defaultQuantity <= v.maximumQuantity, {
    message: "defaultQuantity must be within min/max",
    path: ["defaultQuantity"],
  });

export const updateHowWePrepareOptionDto = howWePrepareOptionBaseSchema.partial();

export const howWePrepareOptionIdParam = z.object({
  id: z.string().uuid(),
});

export type HowWePrepareOptionCreateDTO = z.output<typeof howWePrepareOptionBaseSchema>;
export type HowWePrepareOptionUpdateDTO = z.infer<typeof updateHowWePrepareOptionDto>;
