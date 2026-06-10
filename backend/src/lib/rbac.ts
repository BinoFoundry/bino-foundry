import type { User } from "@supabase/supabase-js";
import type { Permission, UserRole } from "@bino-foundry/shared/types";

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

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  customer: [
    "profile.own.read",
    "profile.own.write",
    "designs.own.read",
    "designs.own.write",
    "orders.own.read",
    "orders.own.write",
    "catalogue.read",
  ],
  staff: [
    "profile.own.read",
    "profile.own.write",
    "catalogue.read",
    "catalogue.write",
    "orders.manage",
    "designs.manage",
    "customers.manage",
  ],
  admin: [
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
  ],
  super_admin: ALL_PERMISSIONS,
};

const ROLE_ALIASES: Record<string, UserRole> = {
  customer: "customer",
  staff: "staff",
  admin: "admin",
  super_admin: "super_admin",
  superadmin: "super_admin",
};

export function resolveUserRole(user: User, profileRole?: string | null): UserRole {
  const appRole = typeof user.app_metadata?.role === "string" ? user.app_metadata.role : null;
  const userRole = typeof user.user_metadata?.role === "string" ? user.user_metadata.role : null;
  const raw = (appRole ?? userRole ?? profileRole ?? "customer").toLowerCase();
  return ROLE_ALIASES[raw] ?? "customer";
}

export function permissionsForRole(role: UserRole): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

export function hasPermission(granted: Permission[], required: Permission): boolean {
  return granted.includes(required);
}

export function isAdminRole(role: UserRole): boolean {
  return role === "admin" || role === "super_admin";
}

export function buildAuthUser(user: User, profileRole?: string | null) {
  const role = resolveUserRole(user, profileRole);
  const permissions = permissionsForRole(role);
  return {
    id: user.id,
    email: user.email ?? null,
    displayName:
      typeof user.user_metadata?.display_name === "string"
        ? user.user_metadata.display_name
        : typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : null,
    emailVerified: Boolean(user.email_confirmed_at),
    role,
    permissions,
  };
}
