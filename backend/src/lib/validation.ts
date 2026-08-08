import { ZodError } from "zod";

import { ValidationError } from "../lib/errors.js";

type ParsableSchema<T> = { parse: (data: unknown) => T };

function parseSchema<T>(schema: ParsableSchema<T>, value: unknown): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError("Request validation failed", error.flatten());
    }
    throw error;
  }
}

export function validateBody<T>(schema: ParsableSchema<T>, body: unknown): T {
  return parseSchema(schema, body);
}

export function validateQuery<T>(schema: ParsableSchema<T>, query: unknown): T {
  return parseSchema(schema, query);
}
