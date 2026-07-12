import {
  CircleDot,
  Gem,
  Glasses,
  LayoutDashboard,
  Package,
  Ruler,
  Settings,
  Settings2,
  Sun,
  Users,
} from "lucide-react";

import type { AdminNavItem, AdminSection } from "./types";

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Overview and quick links",
    icon: LayoutDashboard,
    group: "overview",
  },
  {
    id: "users",
    label: "Users",
    description: "Platform accounts, roles, and access",
    icon: Users,
    group: "platform",
    permission: "customers.manage",
  },
  {
    id: "frames",
    label: "Frames",
    description: "Sunglasses frame SKUs",
    icon: Glasses,
    group: "products",
  },
  {
    id: "beads",
    label: "Bead library",
    description: "Unified beads with crop assets",
    icon: Gem,
    group: "products",
  },
  {
    id: "bead-types",
    label: "Bead types",
    description: "Crystal, charm, spacer categories",
    icon: Settings2,
    group: "products",
  },
  {
    id: "bead-sizes",
    label: "Bead sizes",
    description: "Bracelet mm diameter options",
    icon: Ruler,
    group: "products",
  },
  {
    id: "wrist-sizes",
    label: "Wrist sizes",
    description: "Customer wrist targets and bracelet capacity",
    icon: CircleDot,
    group: "products",
  },
  {
    id: "how-we-prepare",
    label: "How We Prepare",
    description: "Bracelet preparation options before checkout",
    icon: Package,
    group: "products",
  },
  {
    id: "general-settings",
    label: "General settings",
    description: "Site-wide currency and defaults",
    icon: Settings,
    group: "settings",
  },
  {
    id: "sunglasses-config",
    label: "Sunglasses config",
    description: "Lens tints and builder add-on options",
    icon: Sun,
    group: "sunglasses",
  },
];

export const ADMIN_NAV_GROUPS: { id: AdminNavItem["group"]; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "platform", label: "Platform" },
  { id: "products", label: "Products" },
  { id: "settings", label: "Settings" },
  { id: "sunglasses", label: "Sunglasses" },
];

export function getAdminNavItem(id: AdminSection): AdminNavItem | undefined {
  return ADMIN_NAV_ITEMS.find((item) => item.id === id);
}
