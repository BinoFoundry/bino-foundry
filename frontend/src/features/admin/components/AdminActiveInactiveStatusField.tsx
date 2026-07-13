import { adminFieldClass } from "./admin-styles";

export type AdminActiveInactiveStatus = "active" | "inactive";

export function adminStatusFromIsActive(isActive: boolean | undefined | null): AdminActiveInactiveStatus {
  return isActive === false ? "inactive" : "active";
}

export function isActiveFromAdminStatus(status: AdminActiveInactiveStatus): boolean {
  return status === "active";
}

const STATUS_LABELS: Record<AdminActiveInactiveStatus, string> = {
  active: "Active",
  inactive: "Inactive",
};

interface AdminActiveInactiveStatusFieldProps {
  value: boolean | undefined | null;
  onChange: (isActive: boolean) => void;
  hint?: string;
  className?: string;
}

/** Standard master-data status control — maps to `isActive` in the API. */
export function AdminActiveInactiveStatusField({
  value,
  onChange,
  hint,
  className,
}: AdminActiveInactiveStatusFieldProps) {
  const status = adminStatusFromIsActive(value);

  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
      <select
        value={status}
        onChange={(e) => onChange(isActiveFromAdminStatus(e.target.value as AdminActiveInactiveStatus))}
        className={adminFieldClass()}
      >
        {(Object.keys(STATUS_LABELS) as AdminActiveInactiveStatus[]).map((option) => (
          <option key={option} value={option}>
            {STATUS_LABELS[option]}
          </option>
        ))}
      </select>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
