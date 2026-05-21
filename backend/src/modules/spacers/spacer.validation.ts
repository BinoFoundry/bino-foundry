import { z } from "zod";

const uuidParam = z.string().uuid();

const optionalTypeRef = z
  .union([uuidParam, z.literal("")])
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : v));

export const createSpacerDto = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  price: z.number().nonnegative(),
  image: z.string().optional(),
  type: optionalTypeRef,
  description: z.string().optional(),
});

export type CreateSpacerDTO = z.infer<typeof createSpacerDto>;

export const updateSpacerDto = z.object({
  name: z.string().min(1).optional(),
  price: z.number().nonnegative().optional(),
  image: z.string().optional(),
  type: optionalTypeRef,
  description: z.string().optional(),
});

export type UpdateSpacerDTO = z.infer<typeof updateSpacerDto>;

export const spacerIdParam = z.object({
  id: z.string().min(1),
});
