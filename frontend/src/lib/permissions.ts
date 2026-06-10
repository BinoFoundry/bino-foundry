import type { Permission } from "@bino-foundry/shared/types";

/** Check a permission against the list returned by the Current User API. */
export function checkPermission(
  granted: readonly Permission[] | undefined,
  required: Permission,
): boolean {
  return Boolean(granted?.includes(required));
}
