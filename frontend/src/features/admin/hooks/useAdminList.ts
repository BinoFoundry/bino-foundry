import { useCallback, useMemo, useState } from "react";

import type { AdminListController } from "../types";

export function useAdminList<T extends { id: string }>(
  items: T[],
  filterFn: (item: T, query: string) => boolean,
): AdminListController<T> {
  const [search, setSearch] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => filterFn(item, q));
  }, [items, search, filterFn]);

  const requestDelete = useCallback((id: string) => setConfirmDeleteId(id), []);
  const cancelDelete = useCallback(() => setConfirmDeleteId(null), []);
  const isDeleting = useCallback((id: string) => confirmDeleteId === id, [confirmDeleteId]);

  return {
    items: filtered,
    search,
    setSearch,
    confirmDeleteId,
    requestDelete,
    cancelDelete,
    isDeleting,
  };
}
