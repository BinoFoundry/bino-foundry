import { z } from "zod";

export const createTagDto = z.object({
  name: z.string().trim().min(1).max(80),
});

export const tagIdParam = z.object({
  id: z.string().uuid(),
});

export type CreateTagDTO = z.infer<typeof createTagDto>;
