import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, Package } from "lucide-react";

import { formatCurrency } from "@bino-foundry/shared/currency";
import {
  CUSTOMER_ORDER_STATUS_FLOW,
  type CustomerOrderStatus,
  type OrderSnapshot,
} from "@bino-foundry/shared/types";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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

function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusIndex(status: CustomerOrderStatus): number {
  if (status === "cancelled") return -1;
  return CUSTOMER_ORDER_STATUS_FLOW.indexOf(status);
}

function OrderTimeline({ status }: { status: CustomerOrderStatus }) {
  if (status === "cancelled") {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        This order has been cancelled. Contact us if you need help.
      </div>
    );
  }

  const current = statusIndex(status);

  return (
    <ol className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {CUSTOMER_ORDER_STATUS_FLOW.map((step, index) => {
        const done = index <= current;
        const active = index === current;
        return (
          <li
            key={step}
            className={cn(
              "rounded-lg border px-2 py-2 text-center text-xs",
              done ? "border-primary/40 bg-primary/5 text-foreground" : "border-border/50 text-muted-foreground",
              active && "ring-1 ring-primary/50",
            )}
          >
            <span className="inline-flex items-center justify-center gap-1 font-medium">
              {done ? <Check className="h-3 w-3 text-primary" /> : null}
              {statusLabel(step)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function SnapshotSummary({ snapshot }: { snapshot: OrderSnapshot }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        {snapshot.previewThumbnailUrl ? (
          <img
            src={snapshot.previewThumbnailUrl}
            alt=""
            className="h-28 w-28 rounded-lg border border-border/50 object-contain bg-background"
          />
        ) : (
          <div className="flex h-28 w-28 items-center justify-center rounded-lg border border-border/50 bg-background">
            <Package className="h-7 w-7 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1 text-sm">
          <p className="font-medium">{snapshot.designTitle ?? "Custom design"}</p>
          <p className="capitalize text-muted-foreground">{snapshot.productType}</p>
          {snapshot.bracelet ? (
            <>
              <p className="text-muted-foreground">
                Wrist {snapshot.bracelet.wristSizeCmA} cm
                {snapshot.bracelet.twinning
                  ? ` · Matching pair · ${snapshot.bracelet.wristSizeCmB} cm`
                  : ""}
              </p>
              {snapshot.bracelet.preparation ? (
                <p className="text-muted-foreground">
                  {snapshot.bracelet.preparation.name}
                  {snapshot.bracelet.preparation.quantity > 1
                    ? ` × ${snapshot.bracelet.preparation.quantity}`
                    : ""}
                </p>
              ) : null}
            </>
          ) : null}
          {snapshot.sunglasses ? (
            <p className="text-muted-foreground">
              {snapshot.sunglasses.frameName} · {snapshot.sunglasses.lensTintName}
            </p>
          ) : null}
        </div>
      </div>

      {snapshot.bracelet && snapshot.bracelet.items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border/40">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/20 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Bead</th>
                <th className="px-3 py-2 font-medium">Size</th>
                <th className="px-3 py-2 font-medium text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.bracelet.items.map((item, i) => (
                <tr key={`${item.beadLibraryId}-${item.slotPosition}-${i}`} className="border-t border-border/30">
                  <td className="px-3 py-2">{item.beadName}</td>
                  <td className="px-3 py-2">{item.sizeLabel}</td>
                  <td className="px-3 py-2 text-right">
                    {formatCurrency(item.unitPrice, snapshot.currencyCode)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <p className="type-label text-muted-foreground">Product</p>
          <p className="font-medium">{formatCurrency(snapshot.beadSubtotal, snapshot.currencyCode)}</p>
        </div>
        <div>
          <p className="type-label text-muted-foreground">Preparation</p>
          <p className="font-medium">
            {formatCurrency(snapshot.preparationSubtotal, snapshot.currencyCode)}
          </p>
        </div>
        <div>
          <p className="type-label text-muted-foreground">Total</p>
          <p className="font-medium">{formatCurrency(snapshot.totalAmount, snapshot.currencyCode)}</p>
        </div>
      </div>
    </div>
  );
}

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const justPlaced = searchParams.get("placed") === "1";

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

  const details = order.customerDetails as Record<string, string | undefined | null>;
  const snapshot = order.snapshot;

  return (
    <div className="space-y-6">
      <Button type="button" variant="ghost" size="sm" asChild>
        <Link to="/account/orders">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to orders
        </Link>
      </Button>

      {justPlaced ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <p className="font-medium text-foreground">Order submitted</p>
          <p className="mt-1 text-muted-foreground">
            We will review your order and contact you regarding payment and fulfilment. Your order
            number is <span className="font-mono text-foreground">{order.id}</span>.
          </p>
        </div>
      ) : null}

      <div className="portal-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="type-label text-muted-foreground">Order number</p>
            <h3 className="type-h3 mt-1 font-mono text-base sm:text-lg">{order.id}</h3>
            <p className="mt-2 text-sm capitalize text-muted-foreground">
              Status: {statusLabel(order.status)}
            </p>
            <p className="text-sm text-muted-foreground">Placed {formatDate(order.createdAt)}</p>
          </div>
          <p className="type-price text-2xl">
            {formatCurrency(order.totalAmount, order.currencyCode)}
          </p>
        </div>

        <div className="mt-6">
          <p className="type-label mb-2 text-muted-foreground">Progress</p>
          <OrderTimeline status={order.status} />
        </div>

        <div className="mt-6 rounded-xl bg-background/60 p-4">
          <p className="type-label mb-3 text-muted-foreground">Design summary</p>
          {snapshot ? (
            <SnapshotSummary snapshot={snapshot} />
          ) : (
            <div>
              <p className="font-medium">{order.designTitle ?? "Custom design"}</p>
              <p className="text-sm capitalize text-muted-foreground">{order.productType ?? "—"}</p>
            </div>
          )}
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
            {details.notes ? (
              <p className="pt-2 text-muted-foreground">Notes: {details.notes}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
