import { BRACELET_COPY } from "../copy";
import { cn } from "@/lib/utils";

interface BraceletNameFieldProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
}

/** Lightweight bracelet name input for the left sidebar header. */
export function BraceletNameField({ value, onChange, className, id = "bracelet-name" }: BraceletNameFieldProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <label
        htmlFor={id}
        className="text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground"
      >
        {BRACELET_COPY.braceletNameLabel}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={BRACELET_COPY.braceletNamePlaceholder}
        maxLength={120}
        autoComplete="off"
        className="mt-1 w-full border-0 border-b border-border/45 bg-transparent px-0 py-1 font-body text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/45 focus:outline-none focus:ring-0"
      />
    </div>
  );
}
