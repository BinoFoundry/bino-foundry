import { ADMIN_NAV_ITEMS } from "../navigation";
import type { AdminSection } from "../types";

interface AdminMobileNavProps {
  section: AdminSection;
  onSectionChange: (section: AdminSection) => void;
}

export function AdminMobileNav({ section, onSectionChange }: AdminMobileNavProps) {
  return (
    <div className="border-b border-border p-3 md:hidden">
      <label className="sr-only" htmlFor="admin-section-select">
        Admin section
      </label>
      <select
        id="admin-section-select"
        value={section}
        onChange={(e) => onSectionChange(e.target.value as AdminSection)}
        className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm"
      >
        {ADMIN_NAV_ITEMS.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );
}
