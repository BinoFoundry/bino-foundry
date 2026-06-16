import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Clock3, Gem, Glasses, Package, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { designsApi } from "@/services/api/designs";
import { formatDesignDisplayTitle } from "@/features/designs/display-title";
import { ordersApi } from "@/services/api/orders";

import { PortalEmptyState } from "../components/PortalEmptyState";
import { StatCard } from "../components/StatCard";

export function DashboardPage() {
  const designsQuery = useQuery({ queryKey: ["portal-designs"], queryFn: () => designsApi.list() });
  const ordersQuery = useQuery({ queryKey: ["portal-orders"], queryFn: () => ordersApi.list() });

  const designs = designsQuery.data ?? [];
  const orders = ordersQuery.data ?? [];
  const inProgress = designs.filter((d) => d.status === "draft" || d.status === "saved");
  const completedOrders = orders.filter((o) => o.status === "shipped" || o.status === "confirmed");

  const recentDesigns = [...designs]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 3);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Saved designs" value={designs.length} icon={Sparkles} hint="Across all builders" />
        <StatCard label="In progress" value={inProgress.length} icon={Clock3} hint="Drafts and saved work" />
        <StatCard label="Recent orders" value={orders.length} icon={Package} hint="All time" />
        <StatCard label="Completed" value={completedOrders.length} icon={Package} hint="Confirmed or shipped" />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="portal-card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="type-h3">Recent activity</h3>
            <Button type="button" variant="ghost" size="sm" asChild>
              <Link to="/account/designs">View all</Link>
            </Button>
          </div>
          {recentDesigns.length === 0 ? (
            <PortalEmptyState
              title="No designs yet"
              description="Start in the bracelet or sunglasses builder, then save your work to pick up later."
              actionLabel="Design a bracelet"
              actionHref="/bracelet"
            />
          ) : (
            <ul className="space-y-3">
              {recentDesigns.map((design) => (
                <li
                  key={design.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/50 px-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{formatDesignDisplayTitle(design)}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {design.productType} · {design.status}
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="secondary" asChild>
                    <Link
                      to={`/${design.productType === "bracelet" ? "bracelet" : "sunglasses"}?design=${encodeURIComponent(design.id)}`}
                    >
                      Open
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="portal-card p-5">
          <h3 className="type-h3 mb-4">Quick start</h3>
          <div className="grid gap-3">
            <Link
              to="/bracelet"
              className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/50 px-4 py-4 transition-colors state-hoverable"
            >
              <Gem className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Bracelet builder</p>
                <p className="text-xs text-muted-foreground">Compose beads on the strand</p>
              </div>
            </Link>
            <Link
              to="/sunglasses"
              className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/50 px-4 py-4 transition-colors state-hoverable"
            >
              <Glasses className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Sunglasses builder</p>
                <p className="text-xs text-muted-foreground">Configure frame, lens, and extras</p>
              </div>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
