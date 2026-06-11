import type { AccountStatus } from "@bino-foundry/shared/types";

import { findUserById } from "../infra/auth/user-repository.js";
import { UnauthorizedError, ValidationError } from "./errors.js";

export interface UserAccessRow {
  accountStatus: AccountStatus;
  deletedAt: string | null;
}

export async function getUserAccess(userId: string): Promise<UserAccessRow | null> {
  const user = await findUserById(userId);
  if (!user) return null;

  return {
    accountStatus: user.status,
    deletedAt: user.deletedAt,
  };
}

/** @deprecated Use getUserAccess — kept for gradual migration within backend modules. */
export const getProfileAccess = getUserAccess;

export function isAccountActive(access: UserAccessRow | null): boolean {
  if (!access) return false;
  if (access.deletedAt) return false;
  return access.accountStatus === "active";
}

/** Block sign-in for inactive, suspended, or soft-deleted accounts (generic message). */
export function assertCanAuthenticate(access: UserAccessRow | null): void {
  if (isAccountActive(access)) return;
  throw new ValidationError("Invalid email or password");
}

/** Block authenticated API access for non-active accounts. */
export function assertActiveSession(access: UserAccessRow | null): void {
  if (isAccountActive(access)) return;
  throw new UnauthorizedError("Sign in required");
}
