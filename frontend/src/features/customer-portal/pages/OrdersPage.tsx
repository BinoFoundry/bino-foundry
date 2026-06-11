import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Package } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ordersApi } from "@/services/api/orders";
import type { CustomerOrderSummary } from "@bino-foundry/shared/types";

import { PortalEmptyState } from "../components/PortalEmptyState";

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
}

function OrderCard({ order }: { order: CustomerOrderSummary }) {
  return (
    <article className="portal-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-4">
          {order.previewThumbnailUrl ? (
            <img
              src={order.previewThumbnailUrl}
              alt=""
              className="h-16 w-16 rounded-xl border border-border/50 object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted/40">
              <Package className="h-5 w-5 text-primary" />
            </div>
          )}
          <div>
            <p className="font-medium text-foreground">{order.id}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {order.designTitle ?? "Custom order"} · {formatDate(order.createdAt)}
            </p>
            <p className="mt-2 text-sm capitalize text-foreground/80">{order.status}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="type-price text-lg">
            ${order.totalAmount.toFixed(2)} {order.currencyCode}
          </p>
          <Button type="button" size="sm" variant="secondary" className="mt-3" asChild>
            <Link to={`/account/orders/${encodeURIComponent(order.id)}`}>View details</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

export function OrdersPage() {
  const ordersQuery = useQuery({ queryKey: ["portal-orders"], queryFn: () => ordersApi.list() });

  if (ordersQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading orders…</p>;
  }

  const orders = ordersQuery.data ?? [];
  if (orders.length === 0) {
    return (
      <PortalEmptyState
        title="No orders yet"
        description="When you checkout from a saved design, your order history will appear here."
        actionLabel="View my designs"
        actionHref="/account/designs"
      />
    );
  }

  return (
    <div className="grid gap-4">
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}
