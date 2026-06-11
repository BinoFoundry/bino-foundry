import type { AccountStatus, UserRole } from "@bino-foundry/shared/types";

import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";

export interface DbUser {
  id: string;
  roleId: number;
  roleCode: UserRole;
  fullName: string | null;
  email: string;
  passwordHash: string;
  phoneNumber: string | null;
  avatar: string | null;
  status: AccountStatus;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  billingDetails: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

const USER_SELECT =
  "id, role_id, full_name, email, password_hash, phone_number, avatar, status, email_verified_at, last_login_at, billing_details, created_at, updated_at, deleted_at, roles ( code )";

function mapUserRow(row: Record<string, unknown>): DbUser {
  const roles = row.roles as { code?: string } | { code?: string }[] | null;
  const roleCode =
    (Array.isArray(roles) ? roles[0]?.code : roles?.code) ?? "customer";

  return {
    id: String(row.id),
    roleId: Number(row.role_id),
    roleCode: roleCode as UserRole,
    fullName: (row.full_name as string | null) ?? null,
    email: String(row.email),
    passwordHash: String(row.password_hash),
    phoneNumber: (row.phone_number as string | null) ?? null,
    avatar: (row.avatar as string | null) ?? null,
    status: String(row.status ?? "active") as AccountStatus,
    emailVerifiedAt: (row.email_verified_at as string | null) ?? null,
    lastLoginAt: (row.last_login_at as string | null) ?? null,
    billingDetails: (row.billing_details as Record<string, unknown> | null) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: (row.deleted_at as string | null) ?? null,
  };
}

export async function getRoleIdByCode(code: UserRole): Promise<number | null> {
  const supabase = getSupabaseServiceRole();
  const { data, error } = await supabase.from("roles").select("id").eq("code", code).maybeSingle();
  assertNoDbError(error);
  return data ? Number(data.id) : null;
}

export async function findUserById(userId: string): Promise<DbUser | null> {
  const supabase = getSupabaseServiceRole();
  const { data, error } = await supabase
    .from("users")
    .select(USER_SELECT)
    .eq("id", userId)
    .maybeSingle();

  assertNoDbError(error);
  if (!data) return null;
  return mapUserRow(data as Record<string, unknown>);
}

export async function findUserByEmail(email: string): Promise<DbUser | null> {
  const supabase = getSupabaseServiceRole();
  const normalized = email.trim().toLowerCase();
  const { data, error } = await supabase
    .from("users")
    .select(USER_SELECT)
    .eq("email", normalized)
    .is("deleted_at", null)
    .maybeSingle();

  assertNoDbError(error);
  if (!data) return null;
  return mapUserRow(data as Record<string, unknown>);
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  fullName?: string | null;
  phoneNumber?: string | null;
  roleCode?: UserRole;
  status?: AccountStatus;
  emailVerifiedAt?: string | null;
  id?: string;
}

export async function createUser(input: CreateUserInput): Promise<DbUser> {
  const roleId = await getRoleIdByCode(input.roleCode ?? "customer");
  if (!roleId) throw new Error("Default customer role is not configured");

  const supabase = getSupabaseServiceRole();
  const row: Record<string, unknown> = {
    role_id: roleId,
    email: input.email.trim().toLowerCase(),
    password_hash: input.passwordHash,
    full_name: input.fullName ?? null,
    phone_number: input.phoneNumber ?? null,
    status: input.status ?? "active",
    email_verified_at: input.emailVerifiedAt ?? null,
  };
  if (input.id) row.id = input.id;

  const { data, error } = await supabase.from("users").insert(row).select(USER_SELECT).single();
  assertNoDbError(error);
  return mapUserRow(data as Record<string, unknown>);
}

export async function updateUser(userId: string, patch: Record<string, unknown>): Promise<DbUser> {
  const supabase = getSupabaseServiceRole();
  const { data, error } = await supabase
    .from("users")
    .update(patch)
    .eq("id", userId)
    .select(USER_SELECT)
    .single();

  assertNoDbError(error);
  return mapUserRow(data as Record<string, unknown>);
}

export async function touchLastLogin(userId: string): Promise<void> {
  await updateUser(userId, { last_login_at: new Date().toISOString() });
}

export async function listUsersQuery(options: {
  from: number;
  to: number;
  ascending: boolean;
  sortColumn: string;
  roleCode?: UserRole;
  status?: AccountStatus;
  search?: string;
}): Promise<{ rows: DbUser[]; count: number }> {
  const supabase = getSupabaseServiceRole();
  let query = supabase
    .from("users")
    .select(USER_SELECT, { count: "exact" })
    .is("deleted_at", null);

  if (options.roleCode) {
    const roleId = await getRoleIdByCode(options.roleCode);
    if (roleId) query = query.eq("role_id", roleId);
  }
  if (options.status) {
    query = query.eq("status", options.status);
  }
  if (options.search) {
    const safe = options.search.replace(/[%_,.*()"'\\]/g, "").trim();
    if (safe) {
      const term = `%${safe}%`;
      query = query.or(`email.ilike.${term},full_name.ilike.${term}`);
    }
  }

  const { data, error, count } = await query
    .order(options.sortColumn, { ascending: options.ascending, nullsFirst: false })
    .range(options.from, options.to);

  assertNoDbError(error);
  const rows = (data ?? []).map((row) => mapUserRow(row as Record<string, unknown>));
  return { rows, count: count ?? rows.length };
}
