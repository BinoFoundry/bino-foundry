import type { TaxonomyStatusFilter } from "../lib/taxonomy-status-filter";

const OPTIONS: { value: TaxonomyStatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export function AdminTaxonomyStatusFilter({
  value,
  onChange,
}: {
  value: TaxonomyStatusFilter;
  onChange: (value: TaxonomyStatusFilter) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as TaxonomyStatusFilter)}
      className="h-8 rounded-md border border-border bg-muted/50 px-2 text-xs transition-colors focus:border-primary focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
      aria-label="Filter by status"
    >
      {OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
