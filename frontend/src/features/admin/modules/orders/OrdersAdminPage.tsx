import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Package } from "lucide-react";
import { toast } from "sonner";

import { formatCurrency } from "@bino-foundry/shared/currency";
import {
  CUSTOMER_ORDER_STATUSES,
  type AdminOrderDetail,
  type AdminOrderSummary,
  type CustomerOrderStatus,
} from "@bino-foundry/shared/types";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { isApiError, ordersApi } from "@/services/api";

import { AdminEmptyState } from "../../components/AdminEmptyState";
import { AdminListPagination } from "../../components/AdminListPagination";
import { AdminPage } from "../../components/AdminPage";
import { AdminStatusBadge } from "../../components/AdminStatusBadge";
import { AdminToolbar } from "../../components/AdminToolbar";
import { useAdminSectionRefresh } from "../../context/AdminSectionRefreshContext";
import { adminResourcePath } from "../../routing";

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(value),
    );
  } catch {
    return value;
  }
}

function statusVariant(status: CustomerOrderStatus): "success" | "warning" | "muted" | "danger" {
  if (status === "delivered") return "success";
  if (status === "cancelled") return "danger";
  if (status === "pending") return "warning";
  if (status === "paid" || status === "shipped") return "success";
  return "muted";
}

function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function OrderSnapshotPanels({ order }: { order: AdminOrderDetail }) {
  const snapshot = order.snapshot;
  if (!snapshot) {
    return <p className="text-sm text-muted-foreground">No design snapshot on this order.</p>;
  }

  return (
    <div className="space-y-4">
      {snapshot.previewThumbnailUrl ? (
        <img
          src={snapshot.previewThumbnailUrl}
          alt=""
          className="h-40 w-40 rounded-lg border border-border/60 object-contain bg-muted/20"
        />
      ) : (
        <div className="flex h-40 w-40 items-center justify-center rounded-lg border border-border/60 bg-muted/20">
          <Package className="h-8 w-8 text-muted-foreground" />
        </div>
      )}

      {snapshot.bracelet ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            <div>
              <p className="type-label text-muted-foreground">Wrist A</p>
              <p className="font-medium">{snapshot.bracelet.wristSizeCmA} cm</p>
            </div>
            <div>
              <p className="type-label text-muted-foreground">Wrist B</p>
              <p className="font-medium">
                {snapshot.bracelet.twinning ? `${snapshot.bracelet.wristSizeCmB} cm` : "—"}
              </p>
            </div>
            <div>
              <p className="type-label text-muted-foreground">Matching pair</p>
              <p className="font-medium">{snapshot.bracelet.twinning ? "Yes" : "No"}</p>
            </div>
          </div>

          {snapshot.bracelet.preparation ? (
            <div className="rounded-lg border border-border/50 bg-muted/10 p-3 text-sm">
              <p className="type-label text-muted-foreground">Preparation</p>
              <p className="mt-1 font-medium">{snapshot.bracelet.preparation.name}</p>
              <p className="text-muted-foreground">
                Qty {snapshot.bracelet.preparation.quantity} ·{" "}
                {formatCurrency(snapshot.bracelet.preparation.lineTotal, snapshot.currencyCode)}
              </p>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-lg border border-border/50">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/30 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Strand</th>
                  <th className="px-3 py-2 font-medium">Slot</th>
                  <th className="px-3 py-2 font-medium">Bead</th>
                  <th className="px-3 py-2 font-medium">Size</th>
                  <th className="px-3 py-2 font-medium text-right">Price</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.bracelet.items.map((item, i) => (
                  <tr key={`${item.strandIndex}-${item.slotPosition}-${i}`} className="border-t border-border/40">
                    <td className="px-3 py-2">{item.strandIndex === 0 ? "A" : "B"}</td>
                    <td className="px-3 py-2">{item.slotPosition}</td>
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
        </>
      ) : null}

      {snapshot.sunglasses ? (
        <div className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Frame: </span>
            {snapshot.sunglasses.frameName}
          </p>
          <p>
            <span className="text-muted-foreground">Lens: </span>
            {snapshot.sunglasses.lensTintName}
          </p>
        </div>
      ) : null}

      <div className="grid gap-2 border-t border-border/50 pt-3 text-sm sm:grid-cols-3">
        <div>
          <p className="type-label text-muted-foreground">Beads / product</p>
          <p className="font-medium">
            {formatCurrency(snapshot.beadSubtotal, snapshot.currencyCode)}
          </p>
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

function OrderDetailView({
  orderId,
  onBack,
}: {
  orderId: string;
  onBack: () => void;
}) {
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<CustomerOrderStatus>("pending");
  const [notes, setNotes] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ordersApi.adminGet(orderId);
      setOrder(data);
      setStatus(data.status);
      setNotes(data.internalNotes ?? "");
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Could not load order");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveStatus = async () => {
    setSavingStatus(true);
    try {
      const updated = await ordersApi.adminUpdateStatus(orderId, status);
      setOrder(updated);
      toast.success("Order status updated");
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Could not update status");
    } finally {
      setSavingStatus(false);
    }
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      const updated = await ordersApi.adminUpdateNotes(orderId, notes.trim() || null);
      setOrder(updated);
      toast.success("Internal notes saved");
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Could not save notes");
    } finally {
      setSavingNotes(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading order…</p>;
  }
  if (!order) {
    return (
      <div className="space-y-3">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <p className="text-sm text-muted-foreground">Order not found.</p>
      </div>
    );
  }

  const details = order.customerDetails as Record<string, string | undefined | null>;

  return (
    <div className="space-y-6">
      <Button type="button" variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to orders
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="type-label text-muted-foreground">Order</p>
          <h2 className="type-h3 mt-1 font-mono text-base">{order.id}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Placed {formatDate(order.createdAt)}</p>
        </div>
        <AdminStatusBadge label={statusLabel(order.status)} variant={statusVariant(order.status)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
          <h3 className="text-sm font-medium">Customer & shipping</h3>
          <div className="text-sm space-y-1">
            <p className="font-medium">{details.fullName}</p>
            <p>{details.email}</p>
            {details.phone ? <p>{details.phone}</p> : null}
            <p className="pt-2">{details.addressLine1}</p>
            {details.addressLine2 ? <p>{details.addressLine2}</p> : null}
            <p>
              {[details.city, details.state, details.postalCode].filter(Boolean).join(", ")}
            </p>
            <p>{details.country}</p>
            {details.notes ? (
              <p className="pt-2 text-muted-foreground">Customer notes: {details.notes}</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
          <h3 className="text-sm font-medium">Status & notes</h3>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm">
              <span className="type-label text-muted-foreground">Status</span>
              <select
                className="mt-1 block h-9 rounded-md border border-border bg-background px-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as CustomerOrderStatus)}
              >
                {CUSTOMER_ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            <Button type="button" size="sm" disabled={savingStatus} onClick={() => void saveStatus()}>
              {savingStatus ? "Saving…" : "Update status"}
            </Button>
          </div>
          <div>
            <p className="type-label text-muted-foreground">Internal notes</p>
            <Textarea
              className="mt-1"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Fulfilment notes (admin only)"
            />
            <Button
              type="button"
              size="sm"
              className="mt-2"
              disabled={savingNotes}
              onClick={() => void saveNotes()}
            >
              {savingNotes ? "Saving…" : "Save notes"}
            </Button>
          </div>
          <p className="text-lg font-medium">
            {formatCurrency(order.totalAmount, order.currencyCode)}
          </p>
        </section>
      </div>

      <section className="rounded-xl border border-border/60 bg-card p-4">
        <h3 className="mb-3 text-sm font-medium">Design snapshot</h3>
        <OrderSnapshotPanels order={order} />
      </section>
    </div>
  );
}

export function OrdersAdminPage() {
  const navigate = useNavigate();
  const { itemId } = useParams<{ itemId?: string }>();
  const [items, setItems] = useState<AdminOrderSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CustomerOrderStatus | "">("");
  const [loading, setLoading] = useState(true);
  const pageSize = 25;

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ordersApi.adminList({
        page,
        pageSize,
        search: search.trim() || undefined,
        status: statusFilter || undefined,
      });
      setItems(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Could not load orders");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter]);

  useAdminSectionRefresh("Refresh orders", loadOrders);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  if (itemId) {
    return (
      <AdminPage footer={null}>
        <OrderDetailView
          orderId={itemId}
          onBack={() => navigate(adminResourcePath("orders"))}
        />
      </AdminPage>
    );
  }

  return (
    <AdminPage footer={`${total} order(s)`}>
      <AdminToolbar
        search={search}
        onSearchChange={(q) => {
          setSearch(q);
          setPage(1);
        }}
        searchPlaceholder="Search order, customer, design…"
        trailing={
          <select
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as CustomerOrderStatus | "");
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {CUSTOMER_ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        }
      />

      {loading ? (
        <p className="p-4 text-sm text-muted-foreground">Loading orders…</p>
      ) : items.length === 0 ? (
        <AdminEmptyState message="No orders yet. Submitted customer orders will appear here for review and fulfilment." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/60 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 font-medium">Customer</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Total</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((order) => (
                <tr key={order.id} className="border-b border-border/40">
                  <td className="px-3 py-2 font-mono text-xs">{order.id}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{order.customerName ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{order.customerEmail}</p>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDate(order.createdAt)}</td>
                  <td className="px-3 py-2">
                    {formatCurrency(order.totalAmount, order.currencyCode)}
                  </td>
                  <td className="px-3 py-2">
                    <AdminStatusBadge
                      label={statusLabel(order.status)}
                      variant={statusVariant(order.status)}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button type="button" variant="ghost" size="sm" asChild>
                      <Link to={adminResourcePath("orders", order.id)}>View</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminListPagination
        page={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={setPage}
      />
    </AdminPage>
  );
}
