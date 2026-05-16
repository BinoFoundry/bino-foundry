import type { LucideIcon } from "lucide-react";

export type AppModule = "bracelet" | "sunglasses" | "admin";

export interface ModuleNavItem {
  id: AppModule;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
}
