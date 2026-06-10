import { Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/state/auth/AuthProvider";

import { CUSTOMER_NAV, navItemForPath } from "../navigation";

interface CustomerPortalLayoutProps {
  children: ReactNode;
}

export function CustomerPortalLayout({ children }: CustomerPortalLayoutProps) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const active = navItemForPath(location.pathname);

  const primaryNav = CUSTOMER_NAV.filter((item) =>
    ["dashboard", "designs", "orders", "settings"].includes(item.id),
  );

  const designNav = CUSTOMER_NAV.filter((item) =>
    ["designs-bracelet", "designs-sunglasses"].includes(item.id),
  );

  return (
    <div className="surface-page min-h-[100dvh] bg-gradient-to-b from-background via-background to-muted/20">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-md p-2 text-muted-foreground hover:bg-muted md:hidden"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Toggle navigation"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div>
              <Link to="/bracelet" className="type-label text-muted-foreground hover:text-primary">
                Bino Foundry
              </Link>
              <h1 className="type-h3 text-foreground">My portal</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" asChild>
              <Link to="/bracelet">Continue designing</Link>
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => void signOut()}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:py-8">
        <aside
          className={cn(
            "space-y-6 lg:sticky lg:top-6 lg:self-start",
            mobileOpen ? "block" : "hidden lg:block",
          )}
        >
          <div className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm">
            <p className="type-label text-muted-foreground">Signed in as</p>
            <p className="mt-1 truncate text-sm font-medium text-foreground">{user?.email}</p>
            {user?.displayName ? (
              <p className="truncate text-xs text-muted-foreground">{user.displayName}</p>
            ) : null}
          </div>

          <nav className="space-y-1 rounded-2xl border border-border/60 bg-card/70 p-2 shadow-sm">
            {primaryNav.map((item) => (
              <NavLink
                key={item.id}
                to={item.href}
                end={item.href === "/account"}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                    isActive
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="rounded-2xl border border-border/60 bg-card/70 p-2 shadow-sm">
            <p className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              By builder
            </p>
            {designNav.map((item) => (
              <NavLink
                key={item.id}
                to={item.href}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
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
