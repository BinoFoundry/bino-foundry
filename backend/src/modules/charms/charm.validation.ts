import { z } from "zod";

const uuidParam = z.string().uuid();

const optionalTypeRef = z
  .union([uuidParam, z.literal("")])
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : v));

export const createCharmDto = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  price: z.number().nonnegative(),
  image: z.string().optional(),
  type: optionalTypeRef,
  description: z.string().optional(),
});

export type CreateCharmDTO = z.infer<typeof createCharmDto>;

export const updateCharmDto = z.object({
  name: z.string().min(1).optional(),
  price: z.number().nonnegative().optional(),
  image: z.string().optional(),
  type: optionalTypeRef,
  description: z.string().optional(),
});

export type UpdateCharmDTO = z.infer<typeof updateCharmDto>;

export const charmIdParam = z.object({
  id: z.string().min(1),
});
