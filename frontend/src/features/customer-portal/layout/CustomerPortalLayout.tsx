import { type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { cn } from "@/lib/utils";
import { GlobalHeader } from "@/layouts/GlobalHeader";
import { useAuth } from "@/state/auth/AuthProvider";

import { CUSTOMER_NAV, navItemForPath } from "../navigation";

interface CustomerPortalLayoutProps {
  children: ReactNode;
}

export function CustomerPortalLayout({ children }: CustomerPortalLayoutProps) {
  const { user } = useAuth();
  const location = useLocation();
  const active = navItemForPath(location.pathname);

  const sidebarNav = CUSTOMER_NAV.filter((item) =>
    ["dashboard", "designs", "orders", "settings"].includes(item.id),
  );

  const designNav = CUSTOMER_NAV.filter((item) =>
    ["designs-bracelet", "designs-sunglasses"].includes(item.id),
  );

  return (
    <div className="surface-page min-h-[100dvh]">
      <GlobalHeader />

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:py-8">
        <aside className="hidden space-y-6 lg:sticky lg:top-6 lg:block lg:self-start">
          <div className="portal-card p-4">
            <p className="type-label text-muted-foreground">Signed in as</p>
            <p className="mt-1 truncate text-sm font-medium text-foreground">{user?.email}</p>
            {user?.displayName ? (
              <p className="truncate text-xs text-muted-foreground">{user.displayName}</p>
            ) : null}
          </div>

          <nav className="portal-card space-y-1 p-2">
            {sidebarNav.map((item) => (
              <NavLink
                key={item.id}
                to={item.href}
                end={item.href === "/account"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                    isActive
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-selection-muted hover:text-foreground",
                  )
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="portal-card p-2">
            <p className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              By builder
            </p>
            {designNav.map((item) => (
              <NavLink
                key={item.id}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-selection-muted hover:text-foreground",
                  )
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </aside>

        <main className="min-w-0">
          <div className="mb-6">
            <p className="type-label text-muted-foreground">{active.description ?? "Client portal"}</p>
            <h2 className="type-h2 mt-1 text-foreground">{active.label}</h2>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
