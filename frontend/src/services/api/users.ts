import type {
  AdminUserDetail,
  AdminUserDesignSummary,
  AdminUserOrderSummary,
  CreatePlatformUserRequest,
  ListUsersQuery,
  ListUsersResponse,
  UpdatePlatformUserRequest,
} from "@bino-foundry/shared/types";

import { apiRequest } from "./client";

function toQuery(params: ListUsersQuery): string {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  if (params.search) search.set("search", params.search);
  if (params.role) search.set("role", params.role);
  if (params.accountStatus) search.set("accountStatus", params.accountStatus);
  if (params.sort) search.set("sort", params.sort);
  if (params.sortDir) search.set("sortDir", params.sortDir);
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const usersApi = {
  list(query: ListUsersQuery = {}): Promise<ListUsersResponse> {
    return apiRequest<ListUsersResponse>(`/users${toQuery(query)}`);
  },

  get(id: string): Promise<AdminUserDetail> {
    return apiRequest<AdminUserDetail>(`/users/${id}`);
  },

  create(payload: CreatePlatformUserRequest): Promise<AdminUserDetail> {
    return apiRequest<AdminUserDetail>("/users", { method: "POST", body: payload });
  },

  update(id: string, payload: UpdatePlatformUserRequest): Promise<AdminUserDetail> {
    return apiRequest<AdminUserDetail>(`/users/${id}`, { method: "PATCH", body: payload });
  },

  remove(id: string): Promise<{ ok: boolean; deletedAt: string }> {
    return apiRequest(`/users/${id}`, { method: "DELETE" });
  },

  resetPassword(id: string, newPassword: string): Promise<{ ok: boolean; message: string }> {
    return apiRequest(`/users/${id}/reset-password`, {
      method: "POST",
      body: { newPassword },
    });
  },

  listDesigns(id: string): Promise<AdminUserDesignSummary[]> {
    return apiRequest<AdminUserDesignSummary[]>(`/users/${id}/designs`);
  },

  listOrders(id: string): Promise<AdminUserOrderSummary[]> {
    return apiRequest<AdminUserOrderSummary[]>(`/users/${id}/orders`);
  },
};
