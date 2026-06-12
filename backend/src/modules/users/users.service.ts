import type { AccountStatus, UserRole } from "@bino-foundry/shared/types";
import { ASSIGNABLE_USER_ROLES, DEFAULT_SITE_GENERAL_SETTINGS } from "@bino-foundry/shared/types";

import {
  createUser,
  findUserByEmail,
  findUserById,
  getRoleIdByCode,
  listUsersQuery,
  updateUser,
  type DbUser,
} from "../../infra/auth/user-repository.js";
import { revokeAllUserSessions } from "../../infra/auth/session-repository.js";
import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { hashPassword } from "../../lib/password.js";
import { normalizeRoleCode } from "../../lib/rbac.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import type {
  CreateUserDTO,
  ListUsersQueryDTO,
  ResetPasswordDTO,
  UpdateUserDTO,
} from "./users.validation.js";

function mapSortColumn(sort: "createdAt" | "lastLoginAt" | "displayName" | "email"): string {
  switch (sort) {
    case "lastLoginAt":
      return "last_login_at";
    case "displayName":
      return "full_name";
    case "email":
      return "email";
    default:
      return "created_at";
  }
}

function mapUserSummary(row: DbUser, counts?: { designs: number; orders: number }) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.fullName,
    phone: row.phoneNumber,
    role: normalizeRoleCode(row.roleCode),
    accountStatus: row.status,
    emailVerified: Boolean(row.emailVerifiedAt),
    savedDesignsCount: counts?.designs ?? 0,
    ordersCount: counts?.orders ?? 0,
    createdAt: row.createdAt,
    lastLoginAt: row.lastLoginAt,
    updatedAt: row.updatedAt,
    billingDetails: row.billingDetails,
    deletedAt: row.deletedAt,
  };
}

async function fetchCountsForUsers(userIds: string[]): Promise<Map<string, { designs: number; orders: number }>> {
  const result = new Map<string, { designs: number; orders: number }>();
  if (userIds.length === 0) return result;

  const supabase = getSupabaseServiceRole();

  const [{ data: designRows, error: designError }, { data: orderRows, error: orderError }] =
    await Promise.all([
      supabase.from("saved_designs").select("user_id").in("user_id", userIds),
      supabase.from("customer_orders").select("user_id").in("user_id", userIds),
    ]);

  assertNoDbError(designError);
  assertNoDbError(orderError);

  for (const id of userIds) {
    result.set(id, { designs: 0, orders: 0 });
  }

  for (const row of designRows ?? []) {
    const id = String((row as { user_id: string }).user_id);
    const entry = result.get(id);
    if (entry) entry.designs += 1;
  }

  for (const row of orderRows ?? []) {
    const id = String((row as { user_id: string }).user_id);
    const entry = result.get(id);
    if (entry) entry.orders += 1;
  }

  return result;
}

async function requireActiveUser(userId: string): Promise<DbUser> {
  const user = await findUserById(userId);
  if (!user || user.deletedAt) throw new NotFoundError("User not found");
  return user;
}

export class UsersService {
  async list(query: ListUsersQueryDTO) {
    const page = query.page;
    const pageSize = query.pageSize;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { rows, count } = await listUsersQuery({
      from,
      to,
      ascending: query.sortDir === "asc",
      sortColumn: mapSortColumn(query.sort),
      roleCode: query.role,
      status: query.accountStatus,
      search: query.search,
    });

    const userIds = rows.map((r) => r.id);
    const counts = await fetchCountsForUsers(userIds);
    const items = rows.map((row) => {
      const summary = mapUserSummary(row, counts.get(row.id));
      const { billingDetails: _billing, deletedAt: _deleted, ...rest } = summary;
      return rest;
    });

    const total = count;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return { items, total, page, pageSize, totalPages };
  }

  async getById(userId: string) {
    const user = await requireActiveUser(userId);
    const counts = await fetchCountsForUsers([userId]);
    const summary = mapUserSummary(user, counts.get(userId));

    const [recentDesigns, recentOrders] = await Promise.all([
      this.listDesignsForUser(userId, 10),
      this.listOrdersForUser(userId, 10),
    ]);

    return {
      id: summary.id,
      email: summary.email,
      displayName: summary.displayName,
      phone: summary.phone,
      role: summary.role,
      accountStatus: summary.accountStatus,
      emailVerified: summary.emailVerified,
      savedDesignsCount: summary.savedDesignsCount,
      ordersCount: summary.ordersCount,
      createdAt: summary.createdAt,
      lastLoginAt: summary.lastLoginAt,
      updatedAt: summary.updatedAt,
      billingDetails: summary.billingDetails,
      recentDesigns,
      recentOrders,
    };
  }

  async create(dto: CreateUserDTO) {
    if (!ASSIGNABLE_USER_ROLES.includes(dto.role)) {
      throw new ValidationError("Invalid role");
    }

    const passwordHash = await hashPassword(dto.password);
    const existing = await findUserByEmail(dto.email);
    if (existing) {
      throw new ConflictError("A user with this email already exists");
    }

    const created = await createUser({
      email: dto.email,
      passwordHash,
      fullName: dto.displayName ?? null,
      phoneNumber: dto.phone ?? null,
      roleCode: dto.role,
      status: dto.accountStatus,
      emailVerifiedAt: new Date().toISOString(),
    });

    return this.getById(created.id);
  }

  async update(userId: string, dto: UpdateUserDTO) {
    const existing = await requireActiveUser(userId);
    const patch: Record<string, unknown> = {};

    if (dto.displayName !== undefined) patch.full_name = dto.displayName;
    if (dto.phone !== undefined) patch.phone_number = dto.phone;
    if (dto.accountStatus !== undefined) patch.status = dto.accountStatus;
    if (dto.billingDetails !== undefined) patch.billing_details = dto.billingDetails;
    if (dto.email !== undefined) patch.email = dto.email.trim().toLowerCase();
    if (dto.role !== undefined) {
      const roleId = await getRoleIdByCode(dto.role);
      if (!roleId) throw new ValidationError("Invalid role");
      patch.role_id = roleId;
    }

    if (Object.keys(patch).length > 0) {
      await updateUser(userId, patch);
    }

    void existing;
    return this.getById(userId);
  }

  async softDelete(userId: string) {
    await requireActiveUser(userId);
    const now = new Date().toISOString();

    await updateUser(userId, {
      deleted_at: now,
      status: "inactive",
    });
    await revokeAllUserSessions(userId);

    return { ok: true, deletedAt: now };
  }

  async resetPassword(userId: string, dto: ResetPasswordDTO) {
    await requireActiveUser(userId);
    await updateUser(userId, { password_hash: await hashPassword(dto.newPassword) });
    await revokeAllUserSessions(userId);
    return { ok: true, message: "Password updated." };
  }

  async listDesignsForUser(userId: string, limit = 50) {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("saved_designs")
      .select(
        "public_id, title, product_type, status, subtotal, currency_code, preview_thumbnail_url, updated_at",
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(limit);

    assertNoDbError(error);

    return (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: String(r.public_id),
        title: (r.title as string | null) ?? null,
        productType: r.product_type as "bracelet" | "sunglasses",
        status: String(r.status),
        subtotal: Number(r.subtotal ?? 0),
        currencyCode: String(r.currency_code ?? DEFAULT_SITE_GENERAL_SETTINGS.currencyCode),
        previewThumbnailUrl: (r.preview_thumbnail_url as string | null) ?? null,
        updatedAt: String(r.updated_at),
      };
    });
  }

  async listOrdersForUser(userId: string, limit = 50) {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("customer_orders")
      .select(
        "public_id, status, total_amount, currency_code, created_at, saved_designs ( public_id, title, product_type )",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    assertNoDbError(error);

    return (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      const joined = r.saved_designs as Record<string, unknown> | null;
      return {
        id: String(r.public_id),
        status: String(r.status),
        totalAmount: Number(r.total_amount ?? 0),
        currencyCode: String(r.currency_code ?? DEFAULT_SITE_GENERAL_SETTINGS.currencyCode),
        designId: (joined?.public_id as string | null) ?? null,
        designTitle: (joined?.title as string | null) ?? null,
        productType: (joined?.product_type as "bracelet" | "sunglasses" | null) ?? null,
        createdAt: String(r.created_at),
      };
    });
  }
}

export const usersService = new UsersService();
