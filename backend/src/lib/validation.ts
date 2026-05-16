import { ZodError, ZodSchema } from "zod";

import { ValidationError } from "../lib/errors.js";

export function validateBody<T>(schema: ZodSchema<T>, body: unknown): T {
  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError("Request validation failed", error.flatten());
    }
    throw error;
  }
}
