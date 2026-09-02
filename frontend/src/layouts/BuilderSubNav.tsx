import { Link, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/state/auth/AuthProvider";

import { PRIMARY_NAV, isNavLinkActive } from "./platform-navigation";

/**
 * Second row beneath the storefront header, holding everything that belongs to
 * the builder rather than the brand.
 *
 * The header above is a faithful copy of the storefront's, so crossing from the
 * shop into "Design Your Own" doesn't change it. Anything builder-specific —
 * which builder you're in, signing in, and the Bino Foundry credit — lives here
 * instead, where it reads as a section of the site rather than a second site.
 */
export function BuilderSubNav() {
  const location = useLocation();
  const { user, openAuth } = useAuth();

  return (
    <div className="shrink-0 border-b border-border/60 bg-background/60">
      <div className="flex items-center gap-4 px-4 py-2 sm:px-12">
        <nav className="flex min-w-0 items-center gap-1" aria-label="Builder">
          {PRIMARY_NAV.map((item) => {
            const active = isNavLinkActive(item, location.pathname, location.search);
            return (
              <Link
                key={item.id}
                to={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-2 py-1.5 text-[13px] tracking-[0.03em] transition-colors",
                  active
                    ? "font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <span className="ml-auto hidden whitespace-nowrap text-[11px] italic text-muted-foreground sm:block">
          powered by <span className="text-primary">Bino Foundry</span>
        </span>

        {user ? null : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto px-2 py-1 text-[13px] text-muted-foreground"
            onClick={() => openAuth({ mode: "sign-in" })}
          >
            Sign in
          </Button>
        )}
      </div>
    </div>
  );
}
