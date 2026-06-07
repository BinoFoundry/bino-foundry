import { useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAdminApiKey } from "@/config/env";
import { useCatalogue } from "@/state/catalogue";
import { useSunglassesCatalog } from "@/state/sunglasses-catalog";

import { ADMIN_NAV_GROUPS, ADMIN_NAV_ITEMS } from "../navigation";
import type { AdminSection } from "../types";

interface AdminLayoutProps {
  section: AdminSection;
  onSectionChange: (section: AdminSection) => void;
  children: ReactNode;
}

export function AdminLayout({ section, onSectionChange, children }: AdminLayoutProps) {
  const catalogue = useCatalogue();
  const sunglasses = useSunglassesCatalog();
  const activeNav = ADMIN_NAV_ITEMS.find((n) => n.id === section);
  const [refreshing, setRefreshing] = useState(false);
  const hasAdminApiKey = Boolean(getAdminApiKey());

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-4 sm:px-6">
        <div>
          <p className="type-label text-muted-foreground">Admin</p>
          <h2 className="type-h3">
            {activeNav?.label ?? "Dashboard"}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{activeNav?.description}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          disabled={refreshing}
          onClick={() => {
            setRefreshing(true);
            void Promise.all([
              catalogue.refreshFromApi(),
              sunglasses.refreshAdminFromApi(),
            ]).finally(() => setRefreshing(false));
          }}
        >
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh catalogue
        </Button>
      </header>

      {!hasAdminApiKey ? (
        <p className="shrink-0 border-b border-status-warning bg-status-warning px-4 py-2 text-center text-xs">
          Set <code className="rounded bg-background/80 px-1">VITE_ADMIN_API_KEY</code> to match server{" "}
          <code className="rounded bg-background/80 px-1">ADMIN_API_KEY</code> before saving catalogue changes.
          Reads work without a key; writes are blocked on the API.
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <nav
          className="hidden w-52 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border bg-card/30 p-3 md:flex"
          aria-label="Admin sections"
        >
          {ADMIN_NAV_GROUPS.map((group) => (
            <div key={group.id}>
              <p className="type-label mb-2 px-2 text-muted-foreground">
                {group.label}
              </p>
              <ul className="flex flex-col gap-0.5">
                {ADMIN_NAV_ITEMS.filter((item) => item.group === group.id).map((item) => {
                  const Icon = item.icon;
                  const active = section === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => onSectionChange(item.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
