import type { AccountStatus, UserRole } from "@bino-foundry/shared/types";
import { ASSIGNABLE_USER_ROLES } from "@bino-foundry/shared/types";

import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { resolveUserRole } from "../../lib/rbac.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import type {
  CreateUserDTO,
  ListUsersQueryDTO,
  ResetPasswordDTO,
  UpdateUserDTO,
} from "./users.validation.js";

const PROFILE_SELECT =
  "user_id, email, display_name, phone, role, account_status, billing_details, deleted_at, created_at, updated_at, last_login_at";

function mapSortColumn(sort: "createdAt" | "lastLoginAt" | "displayName" | "email"): string {
  switch (sort) {
    case "lastLoginAt":
      return "last_login_at";
    case "displayName":
      return "display_name";
    case "email":
      return "email";
    default:
      return "created_at";
  }
}

function mapProfileRow(row: Record<string, unknown>, counts?: { designs: number; orders: number }, authMeta?: { emailVerified: boolean }) {
  return {
    id: String(row.user_id),
    email: (row.email as string | null) ?? null,
    displayName: (row.display_name as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    role: String(row.role ?? "customer") as UserRole,
    accountStatus: String(row.account_status ?? "active") as AccountStatus,
    emailVerified: authMeta?.emailVerified ?? false,
    savedDesignsCount: counts?.designs ?? 0,
    ordersCount: counts?.orders ?? 0,
    createdAt: String(row.created_at),
    lastLoginAt: (row.last_login_at as string | null) ?? null,
    updatedAt: String(row.updated_at),
    billingDetails: (row.billing_details as Record<string, unknown> | null) ?? {},
    deletedAt: (row.deleted_at as string | null) ?? null,
  };
}

async function fetchAuthUser(userId: string) {
  const supabase = getSupabaseServiceRole();
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data.user) return null;
  return data.user;
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

async function syncRoleToAuth(userId: string, role: UserRole, displayName?: string | null) {
  const supabase = getSupabaseServiceRole();
  const patch: Record<string, unknown> = {
    app_metadata: { role },
    user_metadata: {
      role,
      ...(displayName ? { display_name: displayName } : {}),
    },
  };
  const { error } = await supabase.auth.admin.updateUserById(userId, patch);
  if (error) throw new ValidationError(error.message);
}

export class UsersService {
  async list(query: ListUsersQueryDTO) {
    const supabase = getSupabaseServiceRole();
    const page = query.page;
    const pageSize = query.pageSize;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const ascending = query.sortDir === "asc";

    let dbQuery = supabase
      .from("customer_profiles")
      .select(PROFILE_SELECT, { count: "exact" })
      .is("deleted_at", null);

    if (query.role) {
      dbQuery = dbQuery.eq("role", query.role);
    }
    if (query.accountStatus) {
      dbQuery = dbQuery.eq("account_status", query.accountStatus);
    }
    if (query.search) {
      const safe = query.search.replace(/[%_,.*()"'\\]/g, "").trim();
      if (safe) {
        const term = `%${safe}%`;
        dbQuery = dbQuery.or(`email.ilike.${term},display_name.ilike.${term}`);
      }
    }

    const { data, error, count } = await dbQuery
      .order(mapSortColumn(query.sort), { ascending, nullsFirst: false })
      .range(from, to);

    assertNoDbError(error);

    const rows = (data ?? []) as Record<string, unknown>[];
    const userIds = rows.map((r) => String(r.user_id));
    const counts = await fetchCountsForUsers(userIds);

    const items = await Promise.all(
      rows.map(async (row) => {
        const id = String(row.user_id);
        const authUser = await fetchAuthUser(id);
        return mapProfileRow(row, counts.get(id), {
          emailVerified: Boolean(authUser?.email_confirmed_at),
        });
      }),
    );

    const total = count ?? items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return { items, total, page, pageSize, totalPages };
  }

  async getById(userId: string) {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("customer_profiles")
      .select(PROFILE_SELECT)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    assertNoDbError(error);
    if (!data) throw new NotFoundError("User not found");

    const row = data as Record<string, unknown>;
    const counts = await fetchCountsForUsers([userId]);
    const authUser = await fetchAuthUser(userId);
    const summary = mapProfileRow(row, counts.get(userId), {
      emailVerified: Boolean(authUser?.email_confirmed_at),
    });

    const [recentDesigns, recentOrders] = await Promise.all([
      this.listDesignsForUser(userId, 10),
      this.listOrdersForUser(userId, 10),
    ]);

    return {
      ...summary,
      recentDesigns,
      recentOrders,
    };
  }

  async create(dto: CreateUserDTO) {
    if (!ASSIGNABLE_USER_ROLES.includes(dto.role)) {
      throw new ValidationError("Invalid role");
    }

    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase.auth.admin.createUser({
      email: dto.email,
      password: dto.password,
      email_confirm: true,
      user_metadata: {
        display_name: dto.displayName ?? null,
        role: dto.role,
      },
      app_metadata: { role: dto.role },
    });

    if (error) {
      if (error.message.toLowerCase().includes("already")) {
        throw new ConflictError("A user with this email already exists");
      }
      throw new ValidationError(error.message);
    }
    if (!data.user) throw new ValidationError("Could not create user");

    const { error: profileError } = await supabase.from("customer_profiles").upsert(
      {
        user_id: data.user.id,
        email: dto.email,
        display_name: dto.displayName ?? null,
        phone: dto.phone ?? null,
        role: dto.role,
        account_status: dto.accountStatus,
      },
      { onConflict: "user_id" },
    );

    assertNoDbError(profileError);

    return this.getById(data.user.id);
  }

  async update(userId: string, dto: UpdateUserDTO) {
    const existing = await this.getById(userId);
    const supabase = getSupabaseServiceRole();
    const profilePatch: Record<string, unknown> = {};

    if (dto.displayName !== undefined) profilePatch.display_name = dto.displayName;
    if (dto.phone !== undefined) profilePatch.phone = dto.phone;
    if (dto.role !== undefined) profilePatch.role = dto.role;
    if (dto.accountStatus !== undefined) profilePatch.account_status = dto.accountStatus;
    if (dto.billingDetails !== undefined) profilePatch.billing_details = dto.billingDetails;

    if (dto.email !== undefined && dto.email !== existing.email) {
      const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
        email: dto.email,
      });
      if (authError) throw new ValidationError(authError.message);
      profilePatch.email = dto.email;
    }

    if (dto.role !== undefined || dto.displayName !== undefined) {
      await syncRoleToAuth(
        userId,
        (dto.role ?? existing.role) as UserRole,
        dto.displayName ?? existing.displayName,
      );
    }

    if (Object.keys(profilePatch).length > 0) {
      const { error } = await supabase.from("customer_profiles").update(profilePatch).eq("user_id", userId);
      assertNoDbError(error);
    }

    return this.getById(userId);
  }

  async softDelete(userId: string) {
    await this.getById(userId);
    const supabase = getSupabaseServiceRole();
    const now = new Date().toISOString();

    const { error: profileError } = await supabase
      .from("customer_profiles")
      .update({
        deleted_at: now,
        account_status: "inactive",
      })
      .eq("user_id", userId);

    assertNoDbError(profileError);

    const { error: authError } = await supabase.auth.admin.deleteUser(userId);
    if (authError) {
      throw new ValidationError(authError.message);
    }

    return { ok: true, deletedAt: now };
  }

  async resetPassword(userId: string, dto: ResetPasswordDTO) {
    await this.getById(userId);
    const supabase = getSupabaseServiceRole();
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: dto.newPassword,
    });
    if (error) throw new ValidationError(error.message);
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
        currencyCode: String(r.currency_code ?? "USD"),
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
        currencyCode: String(r.currency_code ?? "USD"),
        designId: (joined?.public_id as string | null) ?? null,
        designTitle: (joined?.title as string | null) ?? null,
        productType: (joined?.product_type as "bracelet" | "sunglasses" | null) ?? null,
        createdAt: String(r.created_at),
      };
    });
  }

  /** Ensure auth-only users appear in profiles (e.g. legacy accounts). */
  async ensureProfileFromAuth(userId: string) {
    const authUser = await fetchAuthUser(userId);
    if (!authUser) return null;

    const role = resolveUserRole(authUser);
    const supabase = getSupabaseServiceRole();
    const { error } = await supabase.from("customer_profiles").upsert(
      {
        user_id: userId,
        email: authUser.email ?? null,
        display_name:
          typeof authUser.user_metadata?.display_name === "string"
            ? authUser.user_metadata.display_name
            : null,
        role,
      },
      { onConflict: "user_id" },
    );
    assertNoDbError(error);
    return role;
  }
}

export const usersService = new UsersService();
