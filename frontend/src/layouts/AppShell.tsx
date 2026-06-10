import { Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/state/auth/AuthProvider";

import { BuilderHeaderActions } from "./BuilderHeaderActions";
import { BuilderSwitcher } from "./BuilderSwitcher";
import { BUILDER_COPY } from "./builder-copy";
import type { AppModule } from "./types";

export interface AppShellProps {
  activeModule: AppModule;
  children: ReactNode;
}

export function AppShell({ activeModule, children }: AppShellProps) {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isBuilder = activeModule === "bracelet" || activeModule === "sunglasses";
  const isManagement = activeModule === "admin" && hasPermission("admin.access");

  const goTo = (id: AppModule) => {
    navigate(`/${id}`);
    setMobileNavOpen(false);
  };

  return (
    <div className="surface-page flex h-[100dvh] flex-col overflow-hidden">
      <header className="layout-header grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-subtle bg-card/50 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center justify-start">
          <Link
            to="/bracelet"
            className="type-feature whitespace-nowrap text-foreground transition-colors hover:text-primary sm:text-h2"
          >
            <span className="text-primary">Bino</span> Foundry
          </Link>
        </div>

        {isBuilder ? (
          <div className="flex justify-center">
            <BuilderSwitcher active={activeModule} onSelect={goTo} />
          </div>
        ) : isManagement ? (
          <div className="hidden justify-center md:flex">
            <span className="type-label text-muted-foreground">Management</span>
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          {isBuilder ? (
            <BuilderHeaderActions />
          ) : isManagement ? (
            <Button type="button" variant="secondary" size="sm" asChild>
              <Link to="/bracelet">{BUILDER_COPY.adminBack}</Link>
            </Button>
          ) : null}

          <button
            type="button"
            aria-expanded={mobileNavOpen}
            aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileNavOpen((o) => !o)}
            className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          >
            {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {mobileNavOpen && isBuilder && (
        <div className="motion-safe-animate border-b border-border bg-background/95 backdrop-blur-sm md:hidden">
          <nav className="flex flex-col gap-1 p-2">
            <BuilderSwitcher active={activeModule} onSelect={goTo} variant="stack" />
          </nav>
        </div>
      )}

      {mobileNavOpen && isManagement && (
        <div className="motion-safe-animate border-b border-border bg-background/95 backdrop-blur-sm md:hidden">
          <nav className="flex flex-col gap-1 p-2">
            <button
              type="button"
              onClick={() => goTo("bracelet")}
              className="type-nav flex items-center gap-3 rounded-md px-4 py-3 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Bracelet Builder
            </button>
          </nav>
        </div>
      )}

      <main className="layout-main relative min-h-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
