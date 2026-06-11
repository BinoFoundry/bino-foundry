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
  { id: "dashboard", label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { id: "users", label: "Users", href: "/admin?section=users", icon: Users },
  { id: "products", label: "Products", href: "/admin?section=frames", icon: Gem },
];

export const ACCOUNT_MENU: NavLinkItem[] = [
  { id: "portal", label: "Dashboard", href: "/account", icon: LayoutDashboard, matchPrefix: "/account" },
  { id: "designs", label: "My Designs", href: "/account/designs", icon: Sparkles, matchPrefix: "/account/designs" },
  { id: "orders", label: "My Orders", href: "/account/orders", icon: Package, matchPrefix: "/account/orders" },
  { id: "settings", label: "Account Details", href: "/account/settings", icon: Settings, matchPrefix: "/account/settings" },
];

export function isNavLinkActive(item: NavLinkItem, pathname: string, search = ""): boolean {
  if (item.href.includes("?section=")) {
    const section = new URLSearchParams(item.href.split("?")[1] ?? "").get("section");
    const current = new URLSearchParams(search).get("section") ?? "dashboard";
    return pathname === "/admin" && section === current;
  }
  if (item.id === "dashboard" && item.href === "/admin") {
    const current = new URLSearchParams(search).get("section") ?? "dashboard";
    return pathname === "/admin" && current === "dashboard";
  }
  if (item.matchPrefix) {
    if (item.matchPrefix === "/account" && item.id === "portal") {
      return pathname === "/account";
    }
    return pathname.startsWith(item.matchPrefix);
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
