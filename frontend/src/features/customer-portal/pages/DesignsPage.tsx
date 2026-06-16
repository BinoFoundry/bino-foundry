import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";

import { CheckoutDialog } from "@/features/account/components/CheckoutDialog";
import { formatDesignDisplayTitle } from "@/features/designs/display-title";
import { designsApi } from "@/services/api/designs";
import { isApiError } from "@/services/api/errors";
import { useAuth } from "@/state/auth/AuthProvider";
import { DEFAULT_SITE_GENERAL_SETTINGS, type SavedDesignSummary } from "@bino-foundry/shared/types";

import { DesignCard } from "../components/DesignCard";
import { PortalEmptyState } from "../components/PortalEmptyState";

type DesignFilter = "all" | "bracelet" | "sunglasses";

export function DesignsPage() {
  const location = useLocation();
  const filter: DesignFilter = useMemo(() => {
    if (location.pathname.endsWith("/bracelet")) return "bracelet";
    if (location.pathname.endsWith("/sunglasses")) return "sunglasses";
    return "all";
  }, [location.pathname]);
  const { user } = useAuth();
  const [checkoutDesign, setCheckoutDesign] = useState<SavedDesignSummary | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const designsQuery = useQuery({
    queryKey: ["portal-designs"],
    queryFn: () => designsApi.list(),
  });

  const designs = useMemo(() => {
    const rows = (designsQuery.data ?? []).filter((d) => d.status !== "archived");
    if (filter === "all") return rows;
    return rows.filter((d) => d.productType === filter);
  }, [designsQuery.data, filter]);

  const handleDelete = async (id: string) => {
    try {
      await designsApi.remove(id);
      await designsQuery.refetch();
      toast.success("Design removed.");
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Could not delete design.");
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

  return (
    <>
      <div className="grid gap-4">
        {designs.map((design) => (
          <DesignCard
            key={design.id}
            design={design}
            duplicating={duplicatingId === design.id}
            onDuplicate={() => void handleDuplicate(design.id)}
            onDelete={() => void handleDelete(design.id)}
            onCheckout={() => setCheckoutDesign(design)}
          />
        ))}
      </div>

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
