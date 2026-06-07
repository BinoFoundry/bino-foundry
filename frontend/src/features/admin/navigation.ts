import { CircleDot, Gem, Glasses, Image, LayoutDashboard, Ruler, Settings, Settings2, Sun } from "lucide-react";

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
  { id: "settings", label: "Settings" },
  { id: "sunglasses", label: "Sunglasses" },
  { id: "assets", label: "Media" },
];

export function getAdminNavItem(id: AdminSection): AdminNavItem | undefined {
  return ADMIN_NAV_ITEMS.find((item) => item.id === id);
}
