import type { AuthenticatedUser, UserRole } from "@bino-foundry/shared/types";

export function isAdminUser(user: Pick<AuthenticatedUser, "role"> | null | undefined): boolean {
  return user?.role === "admin";
}

export function postAuthLandingPath(user: Pick<AuthenticatedUser, "role">): string {
  return isAdminUser(user) ? "/admin" : "/account";
}

export function roleLabel(role: UserRole): string {
  return role === "admin" ? "Admin" : "Customer";
}
