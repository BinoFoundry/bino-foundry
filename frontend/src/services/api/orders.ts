import type {
  AdminOrderDetail,
  AdminOrderSummary,
  CreateOrderRequest,
  CustomerOrderDetail,
  CustomerOrderStatus,
  CustomerOrderSummary,
} from "@bino-foundry/shared/types";

import { apiRequestData } from "./client";

export type OrderDetail = CustomerOrderDetail;

export interface AdminOrderListResult {
  items: AdminOrderSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const ordersApi = {
  list(): Promise<CustomerOrderSummary[]> {
    return apiRequestData<CustomerOrderSummary[]>("/orders");
  },

  get(id: string): Promise<OrderDetail> {
    return apiRequestData<OrderDetail>(`/orders/${encodeURIComponent(id)}`);
  },

  create(body: CreateOrderRequest): Promise<CustomerOrderDetail> {
    return apiRequestData<CustomerOrderDetail>("/orders", { method: "POST", body });
  },

  adminList(params?: {
    status?: CustomerOrderStatus;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<AdminOrderListResult> {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.search) q.set("search", params.search);
    if (params?.page) q.set("page", String(params.page));
    if (params?.pageSize) q.set("pageSize", String(params.pageSize));
    const qs = q.toString();
    return apiRequestData<AdminOrderListResult>(`/orders/admin${qs ? `?${qs}` : ""}`);
  },

  adminGet(id: string): Promise<AdminOrderDetail> {
    return apiRequestData<AdminOrderDetail>(`/orders/admin/${encodeURIComponent(id)}`);
  },

  adminUpdateStatus(id: string, status: CustomerOrderStatus): Promise<AdminOrderDetail> {
    return apiRequestData<AdminOrderDetail>(`/orders/admin/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: { status },
    });
  },

  adminUpdateNotes(id: string, internalNotes: string | null): Promise<AdminOrderDetail> {
    return apiRequestData<AdminOrderDetail>(`/orders/admin/${encodeURIComponent(id)}/notes`, {
      method: "PATCH",
      body: { internalNotes },
    });
  },
};
