import { Gem, Glasses, Menu, Settings, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import LivePrice from "@/components/LivePrice";

import { ModuleNavBar } from "./ModuleNavBar";
import type { AppModule, ModuleNavItem } from "./types";

const NAV_ITEMS: ModuleNavItem[] = [
  { id: "bracelet", label: "Crystal Bracelet", shortLabel: "Bracelet", icon: Gem },
  { id: "sunglasses", label: "Sunglasses", shortLabel: "Shades", icon: Glasses },
  { id: "admin", label: "Admin", shortLabel: "Admin", icon: Settings },
];

export interface AppShellProps {
  activeModule: AppModule;
  braceletPrice: number;
  sunglassesPrice: number;
  children: ReactNode;
}

export function AppShell({
  activeModule,
  braceletPrice,
  sunglassesPrice,
  children,
}: AppShellProps) {
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const livePrice = activeModule === "sunglasses" ? sunglassesPrice : braceletPrice;

  const goTo = (id: AppModule) => {
    navigate(`/${id}`);
    setMobileNavOpen(false);
  };

  return (
    <div className="surface-page flex h-[100dvh] flex-col overflow-hidden">
      <header className="layout-header flex shrink-0 items-center justify-between gap-3 border-b border-subtle bg-card/50 px-4 py-3 sm:px-8 sm:py-5">
        <h1 className="type-feature whitespace-nowrap text-foreground sm:text-h2">
          <span className="text-primary">Bino</span> Foundry
        </h1>

        <div className="hidden items-center gap-6 md:flex">
          <ModuleNavBar items={NAV_ITEMS} active={activeModule} onSelect={goTo} />
          <LivePrice price={livePrice} />
        </div>

        <div className="flex items-center gap-3 md:hidden">
          <LivePrice price={livePrice} />
          <button
            type="button"
            aria-expanded={mobileNavOpen}
            aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileNavOpen((o) => !o)}
            className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {mobileNavOpen && (
        <div className="motion-safe-animate border-b border-border bg-background/95 backdrop-blur-sm md:hidden">
          <nav className="flex flex-col gap-1 p-2">
            <ModuleNavBar items={NAV_ITEMS} active={activeModule} onSelect={goTo} variant="stack" />
          </nav>
        </div>
      )}

      <main className="layout-main relative min-h-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
