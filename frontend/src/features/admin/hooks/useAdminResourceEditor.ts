import { useCallback, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import {
  adminBeadTypePath,
  adminResourcePath,
  adminSectionPath,
  adminSubTypePath,
  withAdminSearch,
} from "../routing";
import type { AdminSection } from "../types";

/**
 * URL-driven editor mode for a standard admin resource list.
 * Paths: `/admin/:section`, `/admin/:section/new`, `/admin/:section/:itemId`
 */
export function useAdminResourceEditor(section: Exclude<AdminSection, "dashboard">) {
  const { itemId: rawItemId } = useParams<{ itemId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const search = location.search;

  const itemId = rawItemId && rawItemId !== "new" ? rawItemId : null;
  const isCreating = rawItemId === "new";
  const isEditing = Boolean(itemId);
  const isOpen = isCreating || isEditing;

  const openCreate = useCallback(() => {
    navigate(withAdminSearch(adminResourcePath(section, "new"), search));
  }, [navigate, search, section]);

  const openEdit = useCallback(
    (id: string) => {
      navigate(withAdminSearch(adminResourcePath(section, id), search));
    },
    [navigate, search, section],
  );

  const close = useCallback(() => {
    navigate(withAdminSearch(adminResourcePath(section), search));
  }, [navigate, search, section]);

  return {
    itemId,
    isCreating,
    isEditing,
    isOpen,
    openCreate,
    openEdit,
    close,
    listPath: adminSectionPath(section),
  };
}

/** Bead-types module: types list + nested sub-types. */
export function useAdminBeadTypesRoute() {
  const params = useParams<{ typeId?: string; subId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const search = location.search;
  const path = location.pathname;

  const typeId = params.typeId && params.typeId !== "new" ? params.typeId : null;
  const isCreatingType = path === "/admin/bead-types/new";
  const isEditingType = Boolean(typeId) && !path.includes("/sub-types");
  const isSubTypesView = path.includes("/sub-types");
  const subId = params.subId && params.subId !== "new" ? params.subId : null;
  const isCreatingSub = path.endsWith("/sub-types/new");
  const isEditingSub = Boolean(subId);

  const openTypesList = useCallback(() => {
    navigate(withAdminSearch(adminBeadTypePath(), search));
  }, [navigate, search]);

  const openCreateType = useCallback(() => {
    navigate(withAdminSearch(`${adminBeadTypePath()}/new`, search));
  }, [navigate, search]);

  const openEditType = useCallback(
    (id: string) => {
      navigate(withAdminSearch(adminBeadTypePath(id), search));
    },
    [navigate, search],
  );

  const openSubTypes = useCallback(
    (id: string) => {
      navigate(withAdminSearch(adminSubTypePath(id), search));
    },
    [navigate, search],
  );

  const openCreateSub = useCallback(
    (parentTypeId: string) => {
      navigate(withAdminSearch(`${adminSubTypePath(parentTypeId)}/new`, search));
    },
    [navigate, search],
  );

  const openEditSub = useCallback(
    (parentTypeId: string, id: string) => {
      navigate(withAdminSearch(adminSubTypePath(parentTypeId, id), search));
    },
    [navigate, search],
  );

  const closeTypeEditor = useCallback(() => {
    navigate(withAdminSearch(adminBeadTypePath(), search));
  }, [navigate, search]);

  const closeSubEditor = useCallback(() => {
    if (!typeId) {
      navigate(withAdminSearch(adminBeadTypePath(), search));
      return;
    }
    navigate(withAdminSearch(adminSubTypePath(typeId), search));
  }, [navigate, search, typeId]);

  return useMemo(
    () => ({
      typeId,
      subId,
      isCreatingType,
      isEditingType,
      isSubTypesView,
      isCreatingSub,
      isEditingSub,
      openTypesList,
      openCreateType,
      openEditType,
      openSubTypes,
      openCreateSub,
      openEditSub,
      closeTypeEditor,
      closeSubEditor,
    }),
    [
      typeId,
      subId,
      isCreatingType,
      isEditingType,
      isSubTypesView,
      isCreatingSub,
      isEditingSub,
      openTypesList,
      openCreateType,
      openEditType,
      openSubTypes,
      openCreateSub,
      openEditSub,
      closeTypeEditor,
      closeSubEditor,
    ],
  );
}
