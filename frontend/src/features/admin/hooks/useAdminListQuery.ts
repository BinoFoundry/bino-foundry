import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import type { AdminListController } from "../types";
import { ADMIN_QUERY } from "../routing";

const DEFAULT_PAGE_SIZE = 25;

/**
 * Admin list controller backed by URL query params (`q`, `page`).
 * Refresh / back / forward restore search + pagination.
 * Delete confirmation stays in component state (not bookmarked).
 */
export function useAdminListQuery<T extends { id: string }>(
  items: T[],
  filterFn: (item: T, query: string) => boolean,
  pageSize = DEFAULT_PAGE_SIZE,
): AdminListController<T> {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get(ADMIN_QUERY.search) ?? "";
  const pageRaw = Number(searchParams.get(ADMIN_QUERY.page) ?? "1");
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const setSearch = useCallback(
    (q: string) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (!q.trim()) params.delete(ADMIN_QUERY.search);
          else params.set(ADMIN_QUERY.search, q);
          params.delete(ADMIN_QUERY.page);
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setPage = useCallback(
    (next: number) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next <= 1) params.delete(ADMIN_QUERY.page);
          else params.set(ADMIN_QUERY.page, String(next));
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => filterFn(item, q));
  }, [items, search, filterFn]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage, setPage]);

  const pagedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const requestDelete = useCallback((id: string) => setConfirmDeleteId(id), []);
  const cancelDelete = useCallback(() => setConfirmDeleteId(null), []);
  const isDeleting = useCallback((id: string) => confirmDeleteId === id, [confirmDeleteId]);

  return {
    items: pagedItems,
    allItems: filtered,
    search,
    setSearch,
    page: safePage,
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
