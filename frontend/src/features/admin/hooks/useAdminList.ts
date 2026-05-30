import { useCallback, useMemo, useState } from "react";

import type { AdminListController } from "../types";

const DEFAULT_PAGE_SIZE = 25;

export function useAdminList<T extends { id: string }>(
  items: T[],
  filterFn: (item: T, query: string) => boolean,
  pageSize = DEFAULT_PAGE_SIZE,
): AdminListController<T> {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => filterFn(item, q));
  }, [items, search, filterFn]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const pagedItems = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize, totalPages]);

  const setSearchAndReset = useCallback((q: string) => {
    setSearch(q);
    setPage(1);
  }, []);

  const requestDelete = useCallback((id: string) => setConfirmDeleteId(id), []);
  const cancelDelete = useCallback(() => setConfirmDeleteId(null), []);
  const isDeleting = useCallback((id: string) => confirmDeleteId === id, [confirmDeleteId]);

  return {
    items: pagedItems,
    allItems: filtered,
    search,
    setSearch: setSearchAndReset,
    page,
    setPage,
    pageSize,
    totalItems: filtered.length,
    totalPages,
    confirmDeleteId,
    requestDelete,
    cancelDelete,
    isDeleting,
  };
}
