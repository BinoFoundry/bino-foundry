import type { LucideIcon } from "lucide-react";
import { Gem, Glasses, LayoutDashboard, Package, Settings, Sparkles } from "lucide-react";

export type CustomerPortalSection =
  | "dashboard"
  | "designs"
  | "designs-bracelet"
  | "designs-sunglasses"
  | "orders"
  | "settings";

export interface CustomerNavItem {
  id: CustomerPortalSection;
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
}

export const CUSTOMER_NAV: CustomerNavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/account",
    icon: LayoutDashboard,
    description: "Overview of your work",
  },
  {
    id: "designs",
    label: "My designs",
    href: "/account/designs",
    icon: Sparkles,
    description: "Resume unfinished work",
  },
  {
    id: "designs-bracelet",
    label: "Bracelet designs",
    href: "/account/designs/bracelet",
    icon: Gem,
  },
  {
    id: "designs-sunglasses",
    label: "Sunglasses designs",
    href: "/account/designs/sunglasses",
    icon: Glasses,
  },
  {
    id: "orders",
    label: "My orders",
    href: "/account/orders",
    icon: Package,
    description: "Order history",
  },
  {
    id: "settings",
    label: "Account details",
    href: "/account/settings",
    icon: Settings,
  },
];

export function navItemForPath(pathname: string): CustomerNavItem {
  const exact = CUSTOMER_NAV.find((item) => item.href === pathname);
  if (exact) return exact;
  if (pathname.startsWith("/account/orders/")) {
    return CUSTOMER_NAV.find((item) => item.id === "orders")!;
  }
  if (pathname.startsWith("/account/designs/bracelet")) {
    return CUSTOMER_NAV.find((item) => item.id === "designs-bracelet")!;
  }
  if (pathname.startsWith("/account/designs/sunglasses")) {
    return CUSTOMER_NAV.find((item) => item.id === "designs-sunglasses")!;
  }
  if (pathname.startsWith("/account/designs")) {
    return CUSTOMER_NAV.find((item) => item.id === "designs")!;
  }
  if (pathname.startsWith("/account/settings")) {
    return CUSTOMER_NAV.find((item) => item.id === "settings")!;
  }
  return CUSTOMER_NAV[0];
}
