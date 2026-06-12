import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { formatCurrency } from "@bino-foundry/shared/currency";

import { Button } from "@/components/ui/button";
import { ordersApi } from "@/services/api/orders";

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeStyle: "short" }).format(
      new Date(value),
    );
  } catch {
    return value;
  }
}

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const orderQuery = useQuery({
    queryKey: ["portal-order", id],
    queryFn: () => ordersApi.get(id!),
    enabled: Boolean(id),
  });

  if (orderQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading order…</p>;
  }

  const order = orderQuery.data;
  if (!order) {
    return <p className="text-sm text-muted-foreground">Order not found.</p>;
  }

  const details = order.customerDetails as Record<string, string | undefined>;

  return (
    <div className="space-y-6">
      <Button type="button" variant="ghost" size="sm" asChild>
        <Link to="/account/orders">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to orders
        </Link>
      </Button>

      <div className="portal-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="type-label text-muted-foreground">Order number</p>
            <h3 className="type-h3 mt-1">{order.id}</h3>
            <p className="mt-2 text-sm capitalize text-muted-foreground">Status: {order.status}</p>
            <p className="text-sm text-muted-foreground">Placed {formatDate(order.createdAt)}</p>
          </div>
          <p className="type-price text-2xl">
            {formatCurrency(order.totalAmount, order.currencyCode)}
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-background/60 p-4">
            <p className="type-label text-muted-foreground">Product</p>
            <p className="mt-1 font-medium">{order.designTitle ?? "Custom design"}</p>
            <p className="text-sm capitalize text-muted-foreground">{order.productType ?? "—"}</p>
          </div>
          <div className="rounded-xl bg-background/60 p-4">
            <p className="type-label text-muted-foreground">Shipment</p>
            <p className="mt-1 text-sm text-muted-foreground">Tracking will appear here when available.</p>
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-background/60 p-4">
          <p className="type-label text-muted-foreground">Shipping details</p>
          <div className="mt-2 space-y-1 text-sm">
            <p>{details.fullName}</p>
            <p>{details.email}</p>
            {details.phone ? <p>{details.phone}</p> : null}
            <p>{details.addressLine1}</p>
            {details.addressLine2 ? <p>{details.addressLine2}</p> : null}
            <p>
              {[details.city, details.state, details.postalCode].filter(Boolean).join(", ")}
            </p>
            <p>{details.country}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
