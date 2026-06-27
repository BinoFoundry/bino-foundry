import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { BeadLibraryEntry } from "@/types/beads";
import { Info } from "lucide-react";

const META_FIELDS: { key: string; label: string }[] = [
  { key: "material", label: "Material" },
  { key: "symbolism", label: "Symbolism" },
  { key: "benefits", label: "Benefits" },
  { key: "healingProperties", label: "Healing properties" },
  { key: "healing_properties", label: "Healing properties" },
  { key: "origin", label: "Origin" },
];

export function beadInfoSections(bead: BeadLibraryEntry): { label: string; value: string }[] {
  const sections: { label: string; value: string }[] = [];
  if (bead.description?.trim()) {
    sections.push({ label: "About", value: bead.description.trim() });
  }
  const meta = bead.metadata ?? {};
  const seen = new Set<string>();
  for (const { key, label } of META_FIELDS) {
    if (seen.has(label)) continue;
    const raw = meta[key];
    if (typeof raw === "string" && raw.trim()) {
      sections.push({ label, value: raw.trim() });
      seen.add(label);
    }
  }
  return sections;
}

interface BeadInfoButtonProps {
  bead: BeadLibraryEntry;
  className?: string;
}

/** Circular info control — opens bead details without triggering add/drag. */
export function BeadInfoButton({ bead, className }: BeadInfoButtonProps) {
  const sections = beadInfoSections(bead);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`About ${bead.name}`}
          className={cn(
            "absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full",
            "border border-border/60 bg-background/90 text-muted-foreground shadow-sm",
            "transition-colors hover:border-border hover:bg-accent hover:text-accent-foreground",
            className,
          )}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <Info className="h-3 w-3" strokeWidth={2} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-72 border-border/80 bg-popover p-3 text-sm shadow-md"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <p className="type-h3 text-sm text-foreground">{bead.name}</p>
        {sections.length > 0 ? (
          <dl className="mt-2 space-y-2">
            {sections.map((section) => (
              <div key={`${section.label}-${section.value.slice(0, 24)}`}>
                <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {section.label}
                </dt>
                <dd className="mt-0.5 text-xs leading-relaxed text-foreground/90">{section.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">Details for this bead will appear here soon.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
