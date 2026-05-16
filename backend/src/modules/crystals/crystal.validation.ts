import { z } from "zod";

const uuidParam = z.string().uuid();

/** Accepts UUID or empty string (treated as “no type”). */
const optionalTypeRef = z
  .union([uuidParam, z.literal("")])
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : v));

export const createCrystalDto = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  price: z.number().nonnegative(),
  image: z.string().optional(),
  type: optionalTypeRef,
  description: z.string().optional(),
});

export type CreateCrystalDTO = z.infer<typeof createCrystalDto>;

export const updateCrystalDto = z.object({
  name: z.string().min(1).optional(),
  price: z.number().nonnegative().optional(),
  image: z.string().optional(),
  type: optionalTypeRef,
  description: z.string().optional(),
});

export type UpdateCrystalDTO = z.infer<typeof updateCrystalDto>;

export const crystalIdParam = z.object({
  id: z.string().min(1),
});
