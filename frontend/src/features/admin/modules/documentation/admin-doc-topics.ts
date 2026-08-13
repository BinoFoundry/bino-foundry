/**
 * In-app admin documentation — topics and copy for the Documentation menu.
 * Keep this as the single source of editor guidance shown in Admin.
 */

export type AdminDocTopicId =
  | "overview"
  | "beads"
  | "bead-types"
  | "strand-render"
  | "dangling-charms"
  | "frames"
  | "sunglasses"
  | "sizes-capacity"
  | "settings";

export interface AdminDocTopic {
  id: AdminDocTopicId;
  label: string;
  summary: string;
}

export const ADMIN_DOC_TOPICS: readonly AdminDocTopic[] = [
  {
    id: "overview",
    label: "Overview",
    summary: "How the admin catalogue fits together and where to start.",
  },
  {
    id: "beads",
    label: "Bead library",
    summary: "Upload, crop, sizes, and saving a bead asset.",
  },
  {
    id: "bead-types",
    label: "Types & sub-types",
    summary: "Categories that drive placement mode and default rendering.",
  },
  {
    id: "strand-render",
    label: "Strand rendering",
    summary: "Calibration hierarchy, defaults vs custom overrides, live preview.",
  },
  {
    id: "dangling-charms",
    label: "Dangling charms",
    summary: "Step-by-step for hanging charms, compare sizes, and large wrists.",
  },
  {
    id: "frames",
    label: "Frames & masks",
    summary: "Sunglasses frame SKUs, plate crop, and lens cutouts.",
  },
  {
    id: "sunglasses",
    label: "Sunglasses config",
    summary: "Lens tints, builder options, and glass look presets.",
  },
  {
    id: "sizes-capacity",
    label: "Sizes & capacity",
    summary: "Bead mm offers, wrist sizes, and bracelet capacity.",
  },
  {
    id: "settings",
    label: "Settings",
    summary: "System defaults, currency, SMTP, and migration tools.",
  },
] as const;

export function isAdminDocTopicId(value: string | null | undefined): value is AdminDocTopicId {
  return Boolean(value && ADMIN_DOC_TOPICS.some((t) => t.id === value));
}

export function parseAdminDocTopic(raw: string | null | undefined): AdminDocTopicId {
  return isAdminDocTopicId(raw) ? raw : "overview";
}
