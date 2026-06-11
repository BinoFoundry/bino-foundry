import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RotateCw } from "lucide-react";

import { cn } from "@/lib/utils";
import type { GradientDirection } from "@/types/sunglasses-catalog";

const DIRECTIONS: {
  id: GradientDirection;
  label: string;
  icon: typeof ArrowDown;
}[] = [
  { id: "top-to-bottom", label: "Top → bottom", icon: ArrowDown },
  { id: "bottom-to-top", label: "Bottom → top", icon: ArrowUp },
  { id: "left-to-right", label: "Left → right", icon: ArrowRight },
  { id: "right-to-left", label: "Right → left", icon: ArrowLeft },
  { id: "custom", label: "Custom angle", icon: RotateCw },
];

interface GradientDirectionPickerProps {
  value: GradientDirection;
  onChange: (direction: GradientDirection) => void;
}

export function GradientDirectionPicker({ value, onChange }: GradientDirectionPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {DIRECTIONS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors",
            value === id
              ? "state-selected-subtle text-foreground ring-1 ring-selection/20"
              : "border-border bg-card text-muted-foreground state-hoverable hover:text-foreground",
          )}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
