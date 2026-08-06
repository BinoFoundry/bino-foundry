import { ChevronDown, Menu, ShoppingBag, User, X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { isAdminUser } from "@/lib/auth-landing";
import { useAuth } from "@/state/auth/AuthProvider";

import { BUILDER_COPY } from "./builder-copy";
import {
  ACCOUNT_MENU,
  ADMIN_MENU,
  PRIMARY_NAV,
  isNavLinkActive,
  logoHref,
  type NavLinkItem,
} from "./platform-navigation";

interface GlobalHeaderProps {
  className?: string;
}

export function GlobalHeader({ className }: GlobalHeaderProps) {
  const { user, openAuth, signOut } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = isAdminUser(user);
  const closeMobile = () => setMobileOpen(false);

  return (
    <header className={cn("shrink-0 border-b border-border/60 bg-background/92 backdrop-blur-sm", className)}>
      <div className="layout-header flex items-center gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <Link
          to={logoHref(Boolean(user), isAdmin)}
          className="type-feature shrink-0 whitespace-nowrap text-foreground transition-colors hover:text-primary sm:text-h2"
        >
          <span className="text-primary">Bino</span> Foundry
        </Link>

        <nav
          className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex"
          aria-label="Main"
        >
          {PRIMARY_NAV.map((item) => (
            <PrimaryNavLink
              key={item.id}
              item={item}
              pathname={location.pathname}
              search={location.search}
            />
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {isAdmin ? <AdminMenu pathname={location.pathname} search={location.search} /> : null}

          {user ? (
            <AccountMenu
              pathname={location.pathname}
              onSignOut={() => void signOut()}
            />
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="hidden gap-1.5 text-muted-foreground sm:inline-flex"
              onClick={() => openAuth({ mode: "sign-in" })}
            >
              Login
            </Button>
          )}

          {user ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              asChild
            >
              <Link to="/account/orders">
                <ShoppingBag className="h-4 w-4" />
                <span className="hidden sm:inline">Orders</span>
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={() => toast.message(BUILDER_COPY.cartComingSoon)}
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">{BUILDER_COPY.cart}</span>
            </Button>
          )}

          <button
            type="button"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((open) => !open)}
            className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="motion-safe-animate border-t border-border bg-background/95 px-2 py-2 backdrop-blur-sm lg:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {PRIMARY_NAV.map((item) => (
              <MobileNavLink
                key={item.id}
                item={item}
                pathname={location.pathname}
                search={location.search}
                onNavigate={closeMobile}
              />
            ))}

            {isAdmin ? (
              <>
                <p className="type-label mt-2 px-3 pt-2 text-muted-foreground">Admin</p>
                {ADMIN_MENU.map((item) => (
                  <MobileNavLink
                    key={item.id}
                    item={item}
                    pathname={location.pathname}
                    search={location.search}
                    onNavigate={closeMobile}
                  />
                ))}
              </>
            ) : null}

            {user ? (
              <>
                <p className="type-label mt-2 px-3 pt-2 text-muted-foreground">My Account</p>
                {ACCOUNT_MENU.map((item) => (
                  <MobileNavLink
                    key={item.id}
                    item={item}
                    pathname={location.pathname}
                    search={location.search}
                    onNavigate={closeMobile}
                  />
                ))}
                <button
                  type="button"
                  className="type-nav rounded-md px-3 py-2.5 text-left text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => {
                    closeMobile();
                    void signOut();
                  }}
                >
                  Logout
                </button>
              </>
            ) : (
              <button
                type="button"
                className="type-nav mt-2 rounded-md px-3 py-2.5 text-left text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => {
                  closeMobile();
                  openAuth({ mode: "sign-in" });
                }}
              >
                Login
              </button>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}

function PrimaryNavLink({
  item,
  pathname,
  search,
}: {
  item: NavLinkItem;
  pathname: string;
  search: string;
}) {
  const active = isNavLinkActive(item, pathname, search);

  return (
    <Link
      to={item.href}
      className={cn(
        "type-nav rounded-md px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      {item.label}
    </Link>
  );
}

function MobileNavLink({
  item,
  pathname,
  search,
  onNavigate,
}: {
  item: NavLinkItem;
  pathname: string;
  search: string;
  onNavigate: () => void;
}) {
  const active = isNavLinkActive(item, pathname, search);
  const Icon = item.icon;

  return (
    <Link
      to={item.href}
      onClick={onNavigate}
      className={cn(
        "type-nav flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors",
        active
          ? "bg-primary/10 text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
      {item.label}
    </Link>
  );
}

function AdminMenu({ pathname, search }: { pathname: string; search: string }) {
  const active = pathname.startsWith("/admin");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "gap-1 text-muted-foreground",
            active && "bg-primary/10 text-foreground",
          )}
        >
          Admin
          <ChevronDown className="h-4 w-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {ADMIN_MENU.map((item) => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem key={item.id} asChild>
              <Link
                to={item.href}
                className={cn(
                  isNavLinkActive(item, pathname, search) && "bg-accent text-accent-foreground",
                )}
              >
                {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
                {item.label}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AccountMenu({
  pathname,
  onSignOut,
}: {
  pathname: string;
  onSignOut: () => void;
}) {
  const active = pathname.startsWith("/account");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "gap-1.5 text-muted-foreground",
            active && "bg-primary/10 text-foreground",
          )}
        >
          <User className="h-4 w-4" />
          <span className="hidden sm:inline">My Account</span>
          <ChevronDown className="hidden h-4 w-4 opacity-70 sm:inline" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {ACCOUNT_MENU.map((item) => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem key={item.id} asChild>
              <Link
                to={item.href}
                className={cn(isNavLinkActive(item, pathname) && "bg-accent text-accent-foreground")}
              >
                {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
                {item.label}
              </Link>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSignOut}>Logout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
