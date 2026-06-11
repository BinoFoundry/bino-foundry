import type { Permission, UserRole } from "@bino-foundry/shared/types";

import type { DbUser } from "../infra/auth/user-repository.js";

/** Internal DB role codes — may extend without changing the public two-role API. */
type DbRoleCode = "customer" | "staff" | "admin" | "super_admin";

const ALL_PERMISSIONS: Permission[] = [
  "profile.own.read",
  "profile.own.write",
  "designs.own.read",
  "designs.own.write",
  "orders.own.read",
  "orders.own.write",
  "admin.access",
  "catalogue.read",
  "catalogue.write",
  "orders.manage",
  "customers.manage",
  "designs.manage",
];

const CUSTOMER_PERMISSIONS: Permission[] = [
  "profile.own.read",
  "profile.own.write",
  "designs.own.read",
  "designs.own.write",
  "orders.own.read",
  "orders.own.write",
  "catalogue.read",
];

const ADMIN_PERMISSIONS: Permission[] = [
  ...CUSTOMER_PERMISSIONS,
  "admin.access",
  "catalogue.write",
  "orders.manage",
  "customers.manage",
  "designs.manage",
];

const DB_ROLE_ALIASES: Record<string, DbRoleCode> = {
  customer: "customer",
  staff: "staff",
  admin: "admin",
  super_admin: "super_admin",
  superadmin: "super_admin",
};

function resolveDbRoleCode(raw: string | null | undefined): DbRoleCode {
  const key = (raw ?? "customer").toLowerCase();
  return DB_ROLE_ALIASES[key] ?? "customer";
}

/** Map internal DB roles to the public two-role model. */
export function toPublicRole(raw: string | null | undefined): UserRole {
  const dbRole = resolveDbRoleCode(raw);
  if (dbRole === "admin" || dbRole === "staff" || dbRole === "super_admin") return "admin";
  return "customer";
}

function permissionsForDbRole(role: DbRoleCode): Permission[] {
  switch (role) {
    case "admin":
    case "super_admin":
      return [...ADMIN_PERMISSIONS];
    case "staff":
      return [
        ...CUSTOMER_PERMISSIONS.filter((p) => p !== "orders.own.write"),
        "catalogue.write",
        "orders.manage",
        "designs.manage",
        "customers.manage",
      ];
    default:
      return [...CUSTOMER_PERMISSIONS];
  }
}

export function permissionsForRole(role: UserRole): Permission[] {
  return role === "admin" ? [...ADMIN_PERMISSIONS] : [...CUSTOMER_PERMISSIONS];
}

export function hasPermission(granted: Permission[], required: Permission): boolean {
  return granted.includes(required);
}

export function isAdminRole(role: UserRole): boolean {
  return role === "admin";
}

export function buildAuthUserFromDb(user: DbUser) {
  const dbRole = resolveDbRoleCode(user.roleCode);
  const role = toPublicRole(user.roleCode);
  const permissions = permissionsForDbRole(dbRole);
  return {
    id: user.id,
    email: user.email,
    displayName: user.fullName,
    emailVerified: Boolean(user.emailVerifiedAt),
    role,
    permissions,
  };
}

export function mapProfileFromDb(user: DbUser) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.fullName,
    phone: user.phoneNumber,
    role: toPublicRole(user.roleCode),
    billingDetails: user.billingDetails,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/** @deprecated Use toPublicRole */
export function normalizeRoleCode(raw: string | null | undefined): UserRole {
  return toPublicRole(raw);
}
