import { isValidHexColor, normalizeHexInput } from "@/features/admin/lib/adminHex";
import { adminFieldClass } from "@/features/admin/components/admin-styles";

interface TintColorControlProps {
  id: string;
  label: string;
  hint?: string;
  required?: boolean;
  value: string;
  onChange: (hex: string) => void;
  onBlur?: () => void;
}

function colorInputValue(hex: string): string {
  return isValidHexColor(hex) ? hex : "#4a5568";
}

export function TintColorControl({
  id,
  label,
  hint,
  required,
  value,
  onChange,
  onBlur,
}: TintColorControlProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          className="h-11 w-14 shrink-0 cursor-pointer rounded-lg border border-border bg-background p-0.5 shadow-sm"
          value={colorInputValue(value)}
          onChange={(e) => onChange(normalizeHexInput(e.target.value))}
        />
        <input
          id={id}
          required={required}
          className={`${adminFieldClass()} font-mono text-sm`}
          placeholder="#2d3748"
          value={value}
          onChange={(e) => onChange(normalizeHexInput(e.target.value))}
          onBlur={onBlur}
        />
      </div>
      {hint ? <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
