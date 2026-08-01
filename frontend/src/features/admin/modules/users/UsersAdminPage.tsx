import { useCallback, useEffect, useState } from "react";
import { Eye, KeyRound, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { isApiError, usersApi } from "@/services/api";
import type {
  AccountStatus,
  AdminUserDetail,
  AdminUserSummary,
  AssignableUserRole,
  UserRole,
} from "@bino-foundry/shared/types";
import { ACCOUNT_STATUSES } from "@bino-foundry/shared/types";

import { AdminDeleteConfirm } from "../../components/AdminDeleteConfirm";
import { AdminEmptyState } from "../../components/AdminEmptyState";
import { AdminListPagination } from "../../components/AdminListPagination";
import { AdminPage } from "../../components/AdminPage";
import { AdminStatusBadge } from "../../components/AdminStatusBadge";
import { AdminToolbar } from "../../components/AdminToolbar";
import { useAdminSectionRefresh } from "../../context/AdminSectionRefreshContext";
import { useAdminUnsavedChangesContext } from "../../unsaved-changes";
import { formatDesignDisplayTitle } from "@/features/designs/display-title";
import { UserForm, type UserFormValues } from "./UserForm";
import { ASSIGNABLE_ROLE_OPTIONS, STATUS_LABELS, displayRoleLabel, formatAdminDate } from "./user-labels";

type ViewState =
  | { mode: "list" }
  | { mode: "create" }
  | { mode: "edit"; user: AdminUserDetail }
  | { mode: "view"; user: AdminUserDetail };

function statusVariant(status: AccountStatus): "success" | "muted" | "danger" {
  if (status === "active") return "success";
  if (status === "suspended") return "danger";
  return "muted";
}

export function UsersAdminPage() {
  const { confirmLeave } = useAdminUnsavedChangesContext();
  const [view, setView] = useState<ViewState>({ mode: "list" });
  const [items, setItems] = useState<AdminUserSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");
  const [statusFilter, setStatusFilter] = useState<AccountStatus | "">("");
  const [sort, setSort] = useState<"createdAt" | "lastLoginAt" | "displayName" | "email">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [resetId, setResetId] = useState<string | null>(null);
  const pageSize = 25;

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersApi.list({
        page,
        pageSize,
        search: search.trim() || undefined,
        role: roleFilter || undefined,
        accountStatus: statusFilter || undefined,
        sort,
        sortDir,
      });
      setItems(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Could not load users");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, roleFilter, statusFilter, sort, sortDir]);

  useEffect(() => {
    if (view.mode === "list") {
      void loadUsers();
    }
  }, [view.mode, loadUsers]);

  useAdminSectionRefresh("Refresh users", loadUsers);

  const openUser = async (id: string, mode: "view" | "edit") => {
    try {
      const user = await usersApi.get(id);
      setView({ mode, user });
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Could not load user");
    }
  };

  const handleCreate = async (values: UserFormValues) => {
    try {
      await usersApi.create({
        email: values.email,
        password: values.password,
        displayName: values.displayName.trim(),
        phone: values.phone || undefined,
        role: values.role,
        accountStatus: values.accountStatus,
      });
      toast.success("User created");
      setView({ mode: "list" });
      setPage(1);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Create failed");
      throw err;
    }
  };

  const handleUpdate = async (userId: string, values: UserFormValues) => {
    try {
      await usersApi.update(userId, {
        email: values.email,
        displayName: values.displayName.trim(),
        phone: values.phone || null,
        role: values.role as AssignableUserRole,
        accountStatus: values.accountStatus,
      });
      toast.success("User updated");
      setView({ mode: "list" });
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Update failed");
      throw err;
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await usersApi.remove(id);
      toast.success("User removed");
      setDeleteId(null);
      void loadUsers();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Delete failed");
    }
  };

  const handleResetPassword = async (id: string) => {
    const next = window.prompt("Enter a new password (min 8 characters):");
    if (!next || next.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    try {
      await usersApi.resetPassword(id, next);
      toast.success("Password updated");
      setResetId(null);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Password reset failed");
    }
  };

  const toggleSort = (column: typeof sort) => {
    if (sort === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(column);
      setSortDir("desc");
    }
    setPage(1);
  };

  if (view.mode === "create") {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <AdminToolbar
          title="New user"
          onBack={() => confirmLeave(() => setView({ mode: "list" }))}
          hideSearch
        />
        <AdminPage>
          <UserForm
            mode="create"
            onCancel={() => setView({ mode: "list" })}
            onSave={handleCreate}
          />
        </AdminPage>
      </div>
    );
  }

  if (view.mode === "edit") {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <AdminToolbar
          title={`Edit · ${view.user.displayName ?? view.user.email ?? "User"}`}
          onBack={() => confirmLeave(() => setView({ mode: "list" }))}
          hideSearch
        />
        <AdminPage>
          <UserForm
            mode="edit"
            initial={view.user}
            onCancel={() => setView({ mode: "list" })}
            onSave={(values) => handleUpdate(view.user.id, values)}
          />
        </AdminPage>
      </div>
    );
  }

  if (view.mode === "view") {
    const user = view.user;
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <AdminToolbar
          title={user.displayName ?? user.email ?? "User"}
          onBack={() => setView({ mode: "list" })}
          hideSearch
          trailing={
            <Button type="button" size="sm" variant="secondary" onClick={() => setView({ mode: "edit", user })}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
          }
        />
        <AdminPage>
          <div className="space-y-8 p-4 sm:p-6">
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DetailField label="Email" value={user.email ?? "—"} />
              <DetailField label="Phone" value={user.phone ?? "—"} />
              <DetailField label="Role" value={displayRoleLabel(user.role)} />
              <DetailField label="Status" value={STATUS_LABELS[user.accountStatus]} />
              <DetailField label="Designs" value={String(user.savedDesignsCount)} />
              <DetailField label="Orders" value={String(user.ordersCount)} />
              <DetailField label="Created" value={formatAdminDate(user.createdAt)} />
              <DetailField label="Last login" value={formatAdminDate(user.lastLoginAt)} />
            </section>

            <section>
              <h3 className="type-label mb-3 text-muted-foreground">Recent designs</h3>
              {user.recentDesigns.length === 0 ? (
                <p className="text-sm text-muted-foreground">No saved designs.</p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {user.recentDesigns.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <span>
                        <span className="font-medium">{formatDesignDisplayTitle(d)}</span>
                        <span className="ml-2 text-muted-foreground capitalize">{d.productType}</span>
                      </span>
                      <AdminStatusBadge label={d.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="type-label mb-3 text-muted-foreground">Recent orders</h3>
              {user.recentOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No orders.</p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {user.recentOrders.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <span>
                        <span className="font-medium">{o.id}</span>
                        {o.designTitle ? (
                          <span className="ml-2 text-muted-foreground">{o.designTitle}</span>
                        ) : null}
                      </span>
                      <AdminStatusBadge label={o.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </AdminPage>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AdminToolbar
        search={search}
        onSearchChange={(q) => {
          setSearch(q);
          setPage(1);
        }}
        searchPlaceholder="Search name or email…"
        onAdd={() => setView({ mode: "create" })}
        addLabel="Create user"
        title="Users"
        trailing={
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-md border border-border bg-muted/50 px-2 py-1.5 text-sm"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value as UserRole | "");
                setPage(1);
              }}
            >
              <option value="">All roles</option>
              {ASSIGNABLE_ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border border-border bg-muted/50 px-2 py-1.5 text-sm"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as AccountStatus | "");
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {ACCOUNT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <AdminPage footer={`${total} user(s)`}>
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading users…</p>
        ) : items.length === 0 ? (
          <AdminEmptyState message="No users match your filters. Create an account to get started." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">
                      <SortButton label="Name" active={sort === "displayName"} onClick={() => toggleSort("displayName")} />
                    </th>
                    <th className="px-4 py-2 font-medium">
                      <SortButton label="Email" active={sort === "email"} onClick={() => toggleSort("email")} />
                    </th>
                    <th className="px-4 py-2 font-medium">Role</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Designs</th>
                    <th className="px-4 py-2 font-medium">Orders</th>
                    <th className="px-4 py-2 font-medium">
                      <SortButton label="Created" active={sort === "createdAt"} onClick={() => toggleSort("createdAt")} />
                    </th>
                    <th className="px-4 py-2 font-medium">
                      <SortButton label="Last login" active={sort === "lastLoginAt"} onClick={() => toggleSort("lastLoginAt")} />
                    </th>
                    <th className="px-4 py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((user) => (
                    <tr key={user.id} className="border-b border-border/60 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{user.displayName ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{user.email ?? "—"}</td>
                      <td className="px-4 py-3">{displayRoleLabel(user.role)}</td>
                      <td className="px-4 py-3">
                        <AdminStatusBadge
                          label={STATUS_LABELS[user.accountStatus]}
                          variant={statusVariant(user.accountStatus)}
                        />
                      </td>
                      <td className="px-4 py-3 tabular-nums">{user.savedDesignsCount}</td>
                      <td className="px-4 py-3 tabular-nums">{user.ordersCount}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatAdminDate(user.createdAt)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatAdminDate(user.lastLoginAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button type="button" size="icon" variant="ghost" aria-label="View" onClick={() => void openUser(user.id, "view")}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button type="button" size="icon" variant="ghost" aria-label="Edit" onClick={() => void openUser(user.id, "edit")}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label="Reset password"
                            onClick={() => setResetId(user.id)}
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label="Delete"
                            onClick={() => setDeleteId(user.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <AdminListPagination
              page={page}
              totalPages={totalPages}
              totalItems={total}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </>
        )}

        {deleteId ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
            <div className="surface-card max-w-md space-y-4 p-6">
              <p className="text-sm font-medium">Delete this user?</p>
              <p className="text-sm text-muted-foreground">
                This removes the auth account and marks the profile as deleted. This cannot be undone.
              </p>
              <AdminDeleteConfirm
                label="Confirm deletion"
                onCancel={() => setDeleteId(null)}
                onConfirm={() => void handleDelete(deleteId)}
              />
            </div>
          </div>
        ) : null}

        {resetId ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
            <div className="surface-card max-w-sm p-6">
              <h3 className="type-h3 mb-2">Reset password</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Set a new password for this user. They will need to use it on next sign-in.
              </p>
              <div className="flex gap-2">
                <Button type="button" onClick={() => void handleResetPassword(resetId)}>
                  Continue
                </Button>
                <Button type="button" variant="ghost" onClick={() => setResetId(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </AdminPage>
    </div>
  );
}

function SortButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={active ? "text-foreground" : ""} onClick={onClick}>
      {label}
    </button>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card px-4 py-3">
      <p className="type-label text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
