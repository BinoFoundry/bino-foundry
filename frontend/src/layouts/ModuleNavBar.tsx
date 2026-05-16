import { cn } from "@/lib/utils";

import type { AppModule, ModuleNavItem } from "./types";

interface ModuleNavBarProps {
  items: ModuleNavItem[];
  active: AppModule;
  onSelect: (id: AppModule) => void;
  variant?: "tabs" | "stack";
}

export function ModuleNavBar({ items, active, onSelect, variant = "tabs" }: ModuleNavBarProps) {
  if (variant === "stack") {
    return (
      <>
        {items.map(({ id, shortLabel, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={cn(
              "flex items-center gap-3 rounded-md px-4 py-3 text-sm font-body transition-all duration-200",
              active === id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {shortLabel}
          </button>
        ))}
      </>
    );
  }

  return (
    <nav className="flex gap-1 rounded-lg border border-border p-1">
      {items.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(id)}
          className={cn(
            "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-body transition-all duration-200",
            active === id
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </nav>
  );
}
