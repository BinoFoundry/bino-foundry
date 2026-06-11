import type { AccountStatus } from "@bino-foundry/shared/types";

export const ROLE_LABELS = {
  customer: "Customer",
  admin: "Admin",
} as const;

export const STATUS_LABELS: Record<AccountStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  suspended: "Suspended",
};

export const ASSIGNABLE_ROLE_OPTIONS = [
  { value: "customer" as const, label: ROLE_LABELS.customer },
  { value: "admin" as const, label: ROLE_LABELS.admin },
];

export function formatAdminDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function displayRoleLabel(role: string): string {
  if (role === "admin") return ROLE_LABELS.admin;
  return ROLE_LABELS.customer;
}
