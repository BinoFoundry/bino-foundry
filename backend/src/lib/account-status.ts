import type { AccountStatus } from "@bino-foundry/shared/types";

import { getSupabaseServiceRole } from "../infra/supabase/adminClient.js";
import { UnauthorizedError, ValidationError } from "./errors.js";
import { assertNoDbError } from "./supabase-db.js";

export interface ProfileAccessRow {
  accountStatus: AccountStatus;
  deletedAt: string | null;
}

export async function getProfileAccess(userId: string): Promise<ProfileAccessRow | null> {
  const supabase = getSupabaseServiceRole();
  const { data, error } = await supabase
    .from("customer_profiles")
    .select("account_status, deleted_at")
    .eq("user_id", userId)
    .maybeSingle();

  assertNoDbError(error);
  if (!data) return null;

  return {
    accountStatus: String(data.account_status ?? "active") as AccountStatus,
    deletedAt: (data.deleted_at as string | null) ?? null,
  };
}

export function isAccountActive(access: ProfileAccessRow | null): boolean {
  if (!access) return true;
  if (access.deletedAt) return false;
  return access.accountStatus === "active";
}

/** Block sign-in for inactive, suspended, or soft-deleted accounts (generic message). */
export function assertCanAuthenticate(access: ProfileAccessRow | null): void {
  if (isAccountActive(access)) return;
  throw new ValidationError("Invalid email or password");
}

/** Block authenticated API access for non-active accounts. */
export function assertActiveSession(access: ProfileAccessRow | null): void {
  if (isAccountActive(access)) return;
  throw new UnauthorizedError("Sign in required");
}

export async function touchLastLogin(userId: string): Promise<void> {
  const supabase = getSupabaseServiceRole();
  const { error } = await supabase
    .from("customer_profiles")
    .update({ last_login_at: new Date().toISOString() })
    .eq("user_id", userId);

  assertNoDbError(error);
}
