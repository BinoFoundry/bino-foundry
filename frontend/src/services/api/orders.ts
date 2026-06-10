import type { CreateOrderRequest, CustomerOrderSummary } from "@bino-foundry/shared/types";

import { apiRequestData } from "./client";

export interface OrderDetail extends CustomerOrderSummary {
  customerDetails: Record<string, unknown>;
  updatedAt: string;
}

export const ordersApi = {
  list(): Promise<CustomerOrderSummary[]> {
    return apiRequestData<CustomerOrderSummary[]>("/orders");
  },

  get(id: string): Promise<OrderDetail> {
    return apiRequestData<OrderDetail>(`/orders/${encodeURIComponent(id)}`);
  },

  create(body: CreateOrderRequest): Promise<CustomerOrderSummary> {
    return apiRequestData<CustomerOrderSummary>("/orders", { method: "POST", body });
  },
};
