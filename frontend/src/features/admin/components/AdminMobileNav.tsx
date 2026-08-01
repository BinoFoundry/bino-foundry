import { useNavigate } from "react-router-dom";

import { checkPermission } from "@/lib/permissions";
import { useAuth } from "@/state/auth/AuthProvider";

import { ADMIN_NAV_ITEMS } from "../navigation";
import { adminSectionPath } from "../routing";
import type { AdminSection } from "../types";

interface AdminMobileNavProps {
  section: AdminSection;
  onSectionChange: (section: AdminSection) => void;
}

export function AdminMobileNav({ section }: AdminMobileNavProps) {
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const visibleNavItems = ADMIN_NAV_ITEMS.filter(
    (item) => !item.permission || checkPermission(permissions, item.permission),
  );

  return (
    <div className="border-b border-border p-3 md:hidden">
      <label className="sr-only" htmlFor="admin-section-select">
        Admin section
      </label>
      <select
        id="admin-section-select"
        value={section}
        onChange={(e) => navigate(adminSectionPath(e.target.value as AdminSection))}
        className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm"
      >
        {visibleNavItems.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );
}
