import type { LucideIcon } from "lucide-react";

/** Top-level admin areas (sidebar). */
export type AdminSection =
  | "dashboard"
  | "frames"
  | "beads"
  | "bead-types"
  | "bead-sizes"
  | "wrist-sizes"
  | "sunglasses-config"
  | "general-settings"
  | "media";

export interface AdminNavItem {
  id: AdminSection;
  label: string;
  description: string;
  icon: LucideIcon;
  group: "overview" | "products" | "settings" | "sunglasses" | "assets";
}

export interface AdminListController<T> {
  items: T[];
  allItems: T[];
  search: string;
  setSearch: (q: string) => void;
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  confirmDeleteId: string | null;
  requestDelete: (id: string) => void;
  cancelDelete: () => void;
  isDeleting: (id: string) => boolean;
}
