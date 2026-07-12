import { cn } from "@/lib/utils";
import { SUB_BEAD_TYPE_ALL, type SubBeadTypeTabValue } from "@/lib/bead-library-search";
import type { SubBeadTypeEntry } from "@/types/beads";

interface SubBeadTypeTabsProps {
  options: SubBeadTypeEntry[];
  value: SubBeadTypeTabValue;
  onChange: (value: SubBeadTypeTabValue) => void;
  allLabel?: string;
  className?: string;
}

export function SubBeadTypeTabs({
  options,
  value,
  onChange,
  allLabel = "All",
  className,
}: SubBeadTypeTabsProps) {
  if (options.length === 0) return null;

  const tabClass = (active: boolean) =>
    cn(
      "border-b-2 pb-1 text-[11px] font-medium transition-colors",
      active
        ? "border-foreground text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground/80",
    );

  return (
    <div
      className={cn("flex flex-wrap gap-x-4 gap-y-2", className)}
      role="tablist"
      aria-label="Sub bead type"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === SUB_BEAD_TYPE_ALL}
        className={tabClass(value === SUB_BEAD_TYPE_ALL)}
        onClick={() => onChange(SUB_BEAD_TYPE_ALL)}
      >
        {allLabel}
      </button>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={value === option.id}
          className={tabClass(value === option.id)}
          onClick={() => onChange(option.id)}
        >
          {option.name}
        </button>
      ))}
    </div>
  );
}
