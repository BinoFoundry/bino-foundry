import { ZodError, ZodSchema } from "zod";

import { ValidationError } from "../lib/errors.js";

function parseSchema<T>(schema: ZodSchema<T>, value: unknown): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError("Request validation failed", error.flatten());
    }
    throw error;
  }
}

export function validateBody<T>(schema: ZodSchema<T>, body: unknown): T {
  return parseSchema(schema, body);
}

export function validateQuery<T>(schema: ZodSchema<T>, query: unknown): T {
  return parseSchema(schema, query);
}
