import type { LucideIcon } from "lucide-react";

/** Top-level admin areas (sidebar). */
export type AdminSection =
  | "dashboard"
  | "frames"
  | "beads"
  | "bead-types"
  | "bead-sizes"
  | "pricing"
  | "media";

export interface AdminNavItem {
  id: AdminSection;
  label: string;
  description: string;
  icon: LucideIcon;
  group: "overview" | "products" | "configuration" | "assets";
}

export interface AdminListController<T> {
  items: T[];
  search: string;
  setSearch: (q: string) => void;
  confirmDeleteId: string | null;
  requestDelete: (id: string) => void;
  cancelDelete: () => void;
  isDeleting: (id: string) => boolean;
}
