import { Gem, Glasses, Image, LayoutDashboard, Settings2, Sun } from "lucide-react";

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
    description: "Crystal, Charm, Spacer, and custom categories",
    icon: Settings2,
    group: "products",
  },
  {
    id: "pricing",
    label: "Sunglasses config",
    description: "Lens tints and add-on options",
    icon: Sun,
    group: "configuration",
  },
  {
    id: "media",
    label: "Media",
    description: "Upload and staging assets",
    icon: Image,
    group: "assets",
  },
];

export const ADMIN_NAV_GROUPS: { id: AdminNavItem["group"]; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "products", label: "Products" },
  { id: "configuration", label: "Pricing & config" },
  { id: "assets", label: "Media" },
];

export function getAdminNavItem(id: AdminSection): AdminNavItem | undefined {
  return ADMIN_NAV_ITEMS.find((item) => item.id === id);
}
