import { CUSTOMER_NAME_REQUIRED_MESSAGE } from "@bino-foundry/shared/constants";

/** Returns a validation message when the customer name is missing after trim. */
export function getCustomerNameValidationError(value: string): string | null {
  return value.trim() ? null : CUSTOMER_NAME_REQUIRED_MESSAGE;
}
