import type { Permission } from "@bino-foundry/shared/types";
import type { LucideIcon } from "lucide-react";

/** Top-level admin areas (sidebar). */
export type AdminSection =
  | "dashboard"
  | "users"
  | "frames"
  | "beads"
  | "bead-types"
  | "bead-sizes"
  | "wrist-sizes"
  | "sunglasses-config"
  | "general-settings";

export interface AdminNavItem {
  id: AdminSection;
  label: string;
  description: string;
  icon: LucideIcon;
  group: "overview" | "platform" | "products" | "settings" | "sunglasses";
  /** When set, item is shown only when the current user has this permission. */
  permission?: Permission;
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
