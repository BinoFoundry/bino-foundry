import { Gem, Glasses } from "lucide-react";

import { cn } from "@/lib/utils";

import { ModuleNavBar } from "./ModuleNavBar";
import type { AppModule, ModuleNavItem } from "./types";

const BUILDER_ITEMS: ModuleNavItem[] = [
  { id: "bracelet", label: "Bracelet Builder", shortLabel: "Bracelet", icon: Gem },
  { id: "sunglasses", label: "Sunglasses Builder", shortLabel: "Sunglasses", icon: Glasses },
];

interface BuilderSwitcherProps {
  active: AppModule;
  onSelect: (id: AppModule) => void;
  variant?: "tabs" | "stack";
  className?: string;
}

/** Customer-facing builder switcher — bracelet and sunglasses only. */
export function BuilderSwitcher({ active, onSelect, variant = "tabs", className }: BuilderSwitcherProps) {
  const items = BUILDER_ITEMS.filter((item) => item.id === "bracelet" || item.id === "sunglasses");

  return (
    <div className={cn("flex justify-center", className)}>
      <ModuleNavBar items={items} active={active} onSelect={onSelect} variant={variant} />
    </div>
  );
}
