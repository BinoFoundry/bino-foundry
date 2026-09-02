import { ChevronDown, Mail, Menu, User, X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

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

import {
  ACCOUNT_MENU,
  ADMIN_MENU,
  PRIMARY_NAV,
  STOREFRONT_DM_URL,
  STOREFRONT_NAV,
  isNavLinkActive,
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
      {/* px-12 / gap-10 mirror the storefront nav: 48px page padding and 40px
          between the wordmark and the first link. */}
      <div className="layout-header flex items-center gap-3 px-4 py-3 sm:gap-10 sm:px-12 sm:py-4">
        {/* Single-line wordmark, as on the storefront. The Bino Foundry credit
            moved to BuilderSubNav so this header stays a faithful copy — a
            customer crossing from the shop shouldn't see it change at all.
            22px/600 matches .nav-logo; set inline because .type-feature drives
            font-size and weight from CSS variables and beats the utilities. */}
        <a
          href="/"
          className="type-feature shrink-0 whitespace-nowrap text-foreground transition-colors hover:text-primary"
          style={{ fontSize: "22px", fontWeight: 600 }}
        >
          New Chapter
        </a>

        {/* The storefront's nav, reproduced — same links, same order, with
            "Design Your Own" active because that's what brought them here.
            Builder-specific navigation lives in BuilderSubNav below. */}
        <nav
          className="hidden min-w-0 flex-1 items-center justify-start gap-[18px] lg:flex"
          aria-label="Main"
        >
          {STOREFRONT_NAV.map((item) => (
            <a
              key={item.id}
              href={item.href}
              aria-current={item.current ? "page" : undefined}
              // 13.5px / .04em tracking matches the storefront's .nav-links a.
              className={cn(
                "rounded-md px-1.5 py-2 text-[13.5px] tracking-[0.04em] transition-colors hover:text-foreground",
                item.current ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {isAdmin ? <AdminMenu pathname={location.pathname} search={location.search} /> : null}

          {/* Signed-in customers get their account menu here; the "Sign in"
              prompt lives in BuilderSubNav instead, so a signed-out visitor
              sees exactly the storefront header. */}
          {user ? (
            <AccountMenu
              pathname={location.pathname}
              onSignOut={() => void signOut()}
            />
          ) : null}

          {/* The storefront's own DM-to-order button. Values copied from its
              `.ig-btn` rule rather than this app's tokens, so the two can't
              drift apart. */}
          <a
            href={STOREFRONT_DM_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-2 font-medium uppercase transition-opacity hover:opacity-90 sm:inline-flex"
            style={{
              background: "#404225",
              color: "#F7E6CA",
              fontSize: "11.5px",
              letterSpacing: "1.15px",
              padding: "10px 18px",
              borderRadius: "2px",
            }}
          >
            <Mail className="h-3.5 w-3.5" />
            DM to order
          </a>

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
            {STOREFRONT_NAV.map((item) => (
              <a
                key={item.id}
                href={item.href}
                onClick={closeMobile}
                className="type-nav rounded-md px-3 py-2.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
            <a
              href={STOREFRONT_DM_URL}
              target="_blank"
              rel="noreferrer"
              onClick={closeMobile}
              className="type-nav rounded-md px-3 py-2.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              DM to order
            </a>
            <span aria-hidden="true" className="my-1 h-px bg-border" />
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
                  Sign out
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
                Sign in
              </button>
            )}
          </nav>
        </div>
      ) : null}
    </header>
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
        <DropdownMenuItem onSelect={onSignOut}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
