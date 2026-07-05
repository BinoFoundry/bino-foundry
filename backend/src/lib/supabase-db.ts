import type { PostgrestError } from "@supabase/supabase-js";

import { ConflictError, ValidationError } from "./errors.js";

export function assertNoDbError(error: PostgrestError | null): asserts error is null {
  if (!error) return;
  if (error.code === "23505") {
    throw new ConflictError("Record violates a unique constraint");
  }
  if (error.code === "23503") {
    throw new ConflictError("This record is referenced by other data and cannot be deleted.");
  }
  throw new ValidationError(error.message, error);
}
