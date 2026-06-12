import { CUSTOMER_NAME_MAX_LENGTH, CUSTOMER_NAME_REQUIRED_MESSAGE } from "@bino-foundry/shared/constants";
import { z } from "zod";

/** Required customer / user display name (trimmed, non-empty). */
export const customerNameSchema = z
  .string({ required_error: CUSTOMER_NAME_REQUIRED_MESSAGE })
  .trim()
  .min(1, CUSTOMER_NAME_REQUIRED_MESSAGE)
  .max(CUSTOMER_NAME_MAX_LENGTH);
