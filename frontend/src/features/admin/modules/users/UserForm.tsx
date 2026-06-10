import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { AccountStatus, AdminUserDetail, AssignableUserRole } from "@bino-foundry/shared/types";
import { ACCOUNT_STATUSES } from "@bino-foundry/shared/types";

import { adminFieldClass } from "../../components/admin-styles";
import { ASSIGNABLE_ROLE_OPTIONS, ROLE_LABELS, STATUS_LABELS } from "./user-labels";

export type UserFormMode = "create" | "edit";

export interface UserFormValues {
  email: string;
  password: string;
  displayName: string;
  phone: string;
  role: AssignableUserRole;
  accountStatus: AccountStatus;
}

interface UserFormProps {
  mode: UserFormMode;
  initial?: AdminUserDetail;
  onCancel: () => void;
  onSave: (values: UserFormValues) => Promise<void>;
}

const defaultValues: UserFormValues = {
  email: "",
  password: "",
  displayName: "",
  phone: "",
  role: "customer",
  accountStatus: "active",
};

export function UserForm({ mode, initial, onCancel, onSave }: UserFormProps) {
  const [values, setValues] = useState<UserFormValues>(() =>
    initial
      ? {
          email: initial.email ?? "",
          password: "",
          displayName: initial.displayName ?? "",
          phone: initial.phone ?? "",
          role: (initial.role === "admin" ? "admin" : "customer") as AssignableUserRole,
          accountStatus: initial.accountStatus,
        }
      : defaultValues,
  );
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof UserFormValues>(key: K, value: UserFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <form
      className="mx-auto max-w-lg space-y-4 p-4 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        setSaving(true);
        void onSave(values).finally(() => setSaving(false));
      }}
    >
      <div>
        <label className="type-label mb-1 block text-muted-foreground">Full name</label>
        <input
          className={adminFieldClass()}
          value={values.displayName}
          onChange={(e) => set("displayName", e.target.value)}
          placeholder="Jane Customer"
        />
      </div>

      <div>
        <label className="type-label mb-1 block text-muted-foreground">Email</label>
        <input
          type="email"
          required
          className={adminFieldClass()}
          value={values.email}
          onChange={(e) => set("email", e.target.value)}
        />
      </div>

      {mode === "create" ? (
        <div>
          <label className="type-label mb-1 block text-muted-foreground">Password</label>
          <input
            type="password"
            required
            minLength={8}
            className={adminFieldClass()}
            value={values.password}
            onChange={(e) => set("password", e.target.value)}
          />
        </div>
      ) : null}

      <div>
        <label className="type-label mb-1 block text-muted-foreground">Phone</label>
        <input
          className={adminFieldClass()}
          value={values.phone}
          onChange={(e) => set("phone", e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="type-label mb-1 block text-muted-foreground">Role</label>
          <select
            className={adminFieldClass()}
            value={values.role}
            onChange={(e) => set("role", e.target.value as AssignableUserRole)}
          >
            {ASSIGNABLE_ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {initial && !ASSIGNABLE_ROLE_OPTIONS.some((o) => o.value === initial.role) ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Current role: {ROLE_LABELS[initial.role]}
            </p>
          ) : null}
        </div>

        <div>
          <label className="type-label mb-1 block text-muted-foreground">Account status</label>
          <select
            className={adminFieldClass()}
            value={values.accountStatus}
            onChange={(e) => set("accountStatus", e.target.value as AccountStatus)}
          >
            {ACCOUNT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : mode === "create" ? "Create user" : "Save changes"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
