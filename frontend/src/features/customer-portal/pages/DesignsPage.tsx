import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckSquare, Loader2 } from "lucide-react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";

import type { SavedDesignSummary } from "@bino-foundry/shared/types";
import { DEFAULT_SITE_GENERAL_SETTINGS } from "@bino-foundry/shared/types";

import { CheckoutDialog } from "@/features/account/components/CheckoutDialog";
import { formatDesignDisplayTitle } from "@/features/designs/display-title";
import { clearPendingDesign, loadPendingDesign } from "@/features/designs/pending-design";
import { Button } from "@/components/ui/button";
import { designsApi } from "@/services/api/designs";
import { isApiError } from "@/services/api/errors";
import { useAuth } from "@/state/auth/AuthProvider";

import { DesignCard } from "../components/DesignCard";
import { DesignDeleteConfirmDialog } from "../components/DesignDeleteConfirmDialog";
import { PortalEmptyState } from "../components/PortalEmptyState";

type DesignFilter = "all" | "bracelet" | "sunglasses";

const DESIGNS_QUERY_KEY = ["portal-designs"] as const;
const EXIT_ANIMATION_MS = 280;

export function DesignsPage() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const filter: DesignFilter = useMemo(() => {
    if (location.pathname.endsWith("/bracelet")) return "bracelet";
    if (location.pathname.endsWith("/sunglasses")) return "sunglasses";
    return "all";
  }, [location.pathname]);
  const { user } = useAuth();

  const [checkoutDesign, setCheckoutDesign] = useState<SavedDesignSummary | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [exitingIds, setExitingIds] = useState<Set<string>>(() => new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirmSingleId, setConfirmSingleId] = useState<string | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);

  const designsQuery = useQuery({
    queryKey: DESIGNS_QUERY_KEY,
    queryFn: () => designsApi.list(),
  });

  const designs = useMemo(() => {
    const rows = (designsQuery.data ?? []).filter((d) => d.status !== "archived");
    if (filter === "all") return rows;
    return rows.filter((d) => d.productType === filter);
  }, [designsQuery.data, filter]);

  const visibleIds = useMemo(() => designs.map((d) => d.id), [designs]);

  useEffect(() => {
    if (!selectionMode) return;
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (visibleIds.includes(id)) next.add(id);
      }
      return next;
    });
  }, [selectionMode, visibleIds]);

  useEffect(() => {
    if (designs.length === 0 && selectionMode) {
      setSelectionMode(false);
      setSelectedIds(new Set());
      setConfirmBulk(false);
    }
  }, [designs.length, selectionMode]);

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setConfirmBulk(false);
  };

  const removeDesignsFromCache = (ids: string[]) => {
    const idSet = new Set(ids);
    queryClient.setQueryData<SavedDesignSummary[]>(DESIGNS_QUERY_KEY, (prev) =>
      (prev ?? []).filter((design) => !idSet.has(design.id)),
    );

    const pending = loadPendingDesign();
    if (pending?.designId && idSet.has(pending.designId)) {
      clearPendingDesign();
    }
  };

  const animateAndRemove = async (ids: string[]) => {
    if (ids.length === 0) return;
    setExitingIds(new Set(ids));
    await new Promise((resolve) => window.setTimeout(resolve, EXIT_ANIMATION_MS));
    removeDesignsFromCache(ids);
    setExitingIds(new Set());
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  };

  const handleConfirmSingleDelete = async () => {
    if (!confirmSingleId || deleting) return;
    const id = confirmSingleId;
    setDeleting(true);
    try {
      await designsApi.remove(id);
      setConfirmSingleId(null);
      await animateAndRemove([id]);
      toast.success("Design deleted successfully.");
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Could not delete design.");
    } finally {
      setDeleting(false);
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (deleting || selectedIds.size === 0) return;
    const ids = [...selectedIds];
    setDeleting(true);
    try {
      const result = await designsApi.bulkRemove(ids);
      setConfirmBulk(false);
      await animateAndRemove(result.deletedIds);

      if (result.failed > 0 && result.deleted > 0) {
        toast.success(
          `${result.deleted} design${result.deleted === 1 ? "" : "s"} deleted. ${result.failed} could not be deleted.`,
        );
      } else if (result.failed > 0) {
        toast.error(
          `${result.failed} design${result.failed === 1 ? "" : "s"} could not be deleted.`,
        );
      } else if (result.deleted > 0) {
        toast.success(
          `${result.deleted} design${result.deleted === 1 ? "" : "s"} deleted successfully.`,
        );
      } else {
        toast.message("No designs were deleted.");
      }
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Could not delete designs.");
    } finally {
      setDeleting(false);
    }
  };

  const handleDuplicate = async (id: string) => {
    setDuplicatingId(id);
    try {
      await designsApi.duplicate(id);
      await designsQuery.refetch();
      toast.success("Design duplicated.");
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Could not duplicate design.");
    } finally {
      setDuplicatingId(null);
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds(new Set(visibleIds));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  if (designsQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading your designs…</p>;
  }

  if (designs.length === 0) {
    const href = filter === "sunglasses" ? "/sunglasses" : "/bracelet";
    const label = filter === "sunglasses" ? "Design sunglasses" : "Design a bracelet";
    return (
      <PortalEmptyState
        title={filter === "all" ? "No saved designs" : `No ${filter} designs`}
        description="Save your work from the builder to resume editing, duplicate, or checkout anytime."
        actionLabel={label}
        actionHref={href}
      />
    );
  }

  const selectedCount = selectedIds.size;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {selectionMode ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">
              Selected: <span className="tabular-nums">{selectedCount}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={deleting || visibleIds.length === 0}
                onClick={selectAllVisible}
              >
                Select All
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={deleting || selectedCount === 0}
                onClick={deselectAll}
              >
                Deselect All
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={deleting || selectedCount === 0}
                onClick={() => setConfirmBulk(true)}
                className="text-[hsl(var(--primary-foreground))] hover:text-[hsl(var(--primary-foreground))]"
              >
                {deleting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Deleting…
                  </>
                ) : (
                  "Delete Selected"
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={deleting}
                onClick={exitSelectionMode}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {designs.length} design{designs.length === 1 ? "" : "s"}
          </p>
        )}

        {!selectionMode ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setSelectionMode(true)}>
            <CheckSquare className="mr-1.5 h-3.5 w-3.5" />
            Select
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4">
        {designs.map((design) => (
          <DesignCard
            key={design.id}
            design={design}
            duplicating={duplicatingId === design.id}
            deleting={deleting && confirmSingleId === design.id}
            selectionMode={selectionMode}
            selected={selectedIds.has(design.id)}
            onToggleSelect={() => toggleSelected(design.id)}
            exiting={exitingIds.has(design.id)}
            onDuplicate={() => void handleDuplicate(design.id)}
            onDelete={() => setConfirmSingleId(design.id)}
            onCheckout={() => setCheckoutDesign(design)}
          />
        ))}
      </div>

      <DesignDeleteConfirmDialog
        open={confirmSingleId != null}
        onOpenChange={(open) => {
          if (!open && !deleting) setConfirmSingleId(null);
        }}
        mode="single"
        busy={deleting}
        onConfirm={() => void handleConfirmSingleDelete()}
      />

      <DesignDeleteConfirmDialog
        open={confirmBulk}
        onOpenChange={(open) => {
          if (!open && !deleting) setConfirmBulk(false);
        }}
        mode="bulk"
        count={selectedCount}
        busy={deleting}
        onConfirm={() => void handleConfirmBulkDelete()}
      />

      <CheckoutDialog
        open={Boolean(checkoutDesign)}
        onOpenChange={(open) => {
          if (!open) setCheckoutDesign(null);
        }}
        designId={checkoutDesign?.id ?? null}
        productLabel={checkoutDesign ? formatDesignDisplayTitle(checkoutDesign) : "Design"}
        totalAmount={checkoutDesign?.subtotal ?? 0}
        currencyCode={checkoutDesign?.currencyCode ?? DEFAULT_SITE_GENERAL_SETTINGS.currencyCode}
        defaultEmail={user?.email}
        defaultName={user?.displayName}
        onOrdered={() => void designsQuery.refetch()}
      />
    </>
  );
}
