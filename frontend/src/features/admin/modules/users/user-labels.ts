import type { AccountStatus, UserRole } from "@bino-foundry/shared/types";
import { ASSIGNABLE_USER_ROLES } from "@bino-foundry/shared/types";

export const ROLE_LABELS: Record<UserRole, string> = {
  customer: "Customer",
  staff: "Staff",
  admin: "Admin",
  super_admin: "Super Admin",
};

export const STATUS_LABELS: Record<AccountStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  suspended: "Suspended",
};

export const ASSIGNABLE_ROLE_OPTIONS = ASSIGNABLE_USER_ROLES.map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
}));

export function formatAdminDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
