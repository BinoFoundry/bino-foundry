import { FlipHorizontal2 } from "lucide-react";

import { cn } from "@/lib/utils";

import { BRACELET_COPY } from "../copy";

export type BraceletMobileViewMode = "A" | "B" | "mirror";

interface BraceletMobileStrandSwitcherProps {
  mode: BraceletMobileViewMode;
  onChange: (mode: BraceletMobileViewMode) => void;
  className?: string;
}

/** Bracelet 1 / Bracelet 2 / Mirror segmented control (mobile mockup). */
export function BraceletMobileStrandSwitcher({
  mode,
  onChange,
  className,
}: BraceletMobileStrandSwitcherProps) {
  const items: { id: BraceletMobileViewMode; label: string; icon?: boolean }[] = [
    { id: "A", label: BRACELET_COPY.mobileBracelet1 },
    { id: "B", label: BRACELET_COPY.mobileBracelet2 },
    { id: "mirror", label: BRACELET_COPY.mobileMirror, icon: true },
  ];

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-sm items-center rounded-full border border-border/70 bg-muted/40 p-1",
        className,
      )}
      role="tablist"
      aria-label={BRACELET_COPY.mobileStrandSwitcherLabel}
    >
      {items.map((item) => {
        const active = mode === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              "flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.icon ? <FlipHorizontal2 className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
