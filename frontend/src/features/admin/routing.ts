import type { AdminSection } from "./types";

/** All addressable admin modules (sidebar sections). */
export const ADMIN_SECTIONS = [
  "dashboard",
  "documentation",
  "users",
  "orders",
  "frames",
  "beads",
  "bead-types",
  "bead-sizes",
  "wrist-sizes",
  "how-we-prepare",
  "general-settings",
  "sunglasses-config",
  "lens-render-presets",
] as const satisfies readonly AdminSection[];

const ADMIN_SECTION_SET = new Set<string>(ADMIN_SECTIONS);

export function isAdminSection(value: string | null | undefined): value is AdminSection {
  return Boolean(value && ADMIN_SECTION_SET.has(value));
}

export function parseAdminSection(raw: string | null | undefined): AdminSection {
  return isAdminSection(raw) ? raw : "dashboard";
}

/** Canonical path for an admin section (dashboard → `/admin`). */
export function adminSectionPath(section: AdminSection): string {
  return section === "dashboard" ? "/admin" : `/admin/${section}`;
}

/** List / create / edit paths for a resource section. */
export function adminResourcePath(
  section: Exclude<AdminSection, "dashboard">,
  itemId?: string | null,
): string {
  const base = adminSectionPath(section);
  if (!itemId) return base;
  return `${base}/${encodeURIComponent(itemId)}`;
}

export function adminBeadTypePath(typeId?: string | null): string {
  if (!typeId) return "/admin/bead-types";
  return `/admin/bead-types/${encodeURIComponent(typeId)}`;
}

export function adminSubTypePath(typeId: string, subId?: string | null): string {
  const base = `/admin/bead-types/${encodeURIComponent(typeId)}/sub-types`;
  if (!subId) return base;
  return `${base}/${encodeURIComponent(subId)}`;
}

export type SunglassesConfigSection = "tints" | "options";

/** Sunglasses config list / create / edit paths. */
export function adminSunglassesConfigPath(
  section?: SunglassesConfigSection | null,
  itemId?: string | null,
): string {
  if (!section) return "/admin/sunglasses-config";
  const base = `/admin/sunglasses-config/${section}`;
  if (!itemId) return base;
  return `${base}/${encodeURIComponent(itemId)}`;
}

/** Preserve list query string when opening/closing an editor. */
export function withAdminSearch(path: string, search: string): string {
  const q = search.startsWith("?") ? search.slice(1) : search;
  if (!q) return path;
  return `${path}?${q}`;
}

/** Shared list/filter query keys used across admin modules. */
export const ADMIN_QUERY = {
  search: "q",
  page: "page",
  sort: "sort",
  sortDir: "sortDir",
  tab: "tab",
  status: "status",
  role: "role",
  family: "family",
  typeId: "typeId",
  subBeadTypeId: "subBeadTypeId",
  view: "view",
} as const;

export type AdminQueryKey = (typeof ADMIN_QUERY)[keyof typeof ADMIN_QUERY];
