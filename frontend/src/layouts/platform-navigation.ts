import type { LucideIcon } from "lucide-react";
import {
  Gem,
  Glasses,
  LayoutDashboard,
  Package,
  Settings,
  Sparkles,
  User,
  Users,
} from "lucide-react";

export type PlatformArea = "storefront" | "account" | "admin";

export interface NavLinkItem {
  id: string;
  label: string;
  href: string;
  icon?: LucideIcon;
  matchPrefix?: string;
}

/**
 * Links back out to the New Chapter storefront that hosts this builder.
 *
 * Plain hrefs, never react-router `Link`s — these leave the SPA. The builder is
 * served under /design on thenewchapterstudio.com, so a root-relative href
 * lands on the storefront. Without them a customer who reaches the builder has
 * no way back to the shop.
 */
export const STOREFRONT_NAV: NavLinkItem[] = [
  { id: "story", label: "Our story", href: "/#story" },
  { id: "shop", label: "Shop", href: "/shop" },
  { id: "services", label: "Services", href: "/services" },
];

/** Always visible primary navigation in the global header. */
export const PRIMARY_NAV: NavLinkItem[] = [
  { id: "bracelet", label: "Bracelet Builder", href: "/bracelet", icon: Gem, matchPrefix: "/bracelet" },
  {
    id: "sunglasses",
    label: "Sunglasses Builder",
    href: "/sunglasses",
    icon: Glasses,
    matchPrefix: "/sunglasses",
  },
];

export const ADMIN_MENU: NavLinkItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/admin", icon: LayoutDashboard, matchPrefix: "/admin" },
  { id: "users", label: "Users", href: "/admin/users", icon: Users, matchPrefix: "/admin/users" },
  { id: "products", label: "Products", href: "/admin/frames", icon: Gem, matchPrefix: "/admin/frames" },
];

export const ACCOUNT_MENU: NavLinkItem[] = [
  { id: "portal", label: "Dashboard", href: "/account", icon: LayoutDashboard, matchPrefix: "/account" },
  { id: "designs", label: "My Designs", href: "/account/designs", icon: Sparkles, matchPrefix: "/account/designs" },
  { id: "orders", label: "My Orders", href: "/account/orders", icon: Package, matchPrefix: "/account/orders" },
  { id: "settings", label: "Account Details", href: "/account/settings", icon: Settings, matchPrefix: "/account/settings" },
];

export function isNavLinkActive(item: NavLinkItem, pathname: string, search = ""): boolean {
  void search;
  if (item.id === "dashboard" && item.href === "/admin") {
    return pathname === "/admin" || pathname === "/admin/";
  }
  if (item.id === "portal" && item.matchPrefix === "/account") {
    return pathname === "/account" || pathname === "/account/";
  }
  if (item.matchPrefix) {
    return pathname === item.matchPrefix || pathname.startsWith(`${item.matchPrefix}/`);
  }
  return pathname === item.href;
}

export function platformAreaForPath(pathname: string): PlatformArea {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/account")) return "account";
  return "storefront";
}

export function logoHref(isAuthenticated: boolean, isAdmin: boolean): string {
  if (!isAuthenticated) return "/bracelet";
  return isAdmin ? "/admin" : "/account";
}
