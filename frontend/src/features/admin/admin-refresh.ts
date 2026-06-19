import type { AdminSection } from "./types";

export interface SectionRefreshConfig {
  label: string;
  action: () => Promise<void>;
}

interface CatalogueRefreshApi {
  refreshFromApi: () => Promise<void>;
}

interface SunglassesRefreshApi {
  refreshAdminFromApi: () => Promise<void>;
}

/** Default toolbar refresh label and action per admin section. */
export function getDefaultSectionRefresh(
  section: AdminSection,
  catalogue: CatalogueRefreshApi,
  sunglasses: SunglassesRefreshApi,
): SectionRefreshConfig {
  switch (section) {
    case "dashboard":
      return {
        label: "Refresh dashboard",
        action: async () => {
          await Promise.all([catalogue.refreshFromApi(), sunglasses.refreshAdminFromApi()]);
        },
      };
    case "users":
      return {
        label: "Refresh users",
        action: async () => {},
      };
    case "frames":
      return {
        label: "Refresh frames",
        action: () => catalogue.refreshFromApi(),
      };
    case "beads":
      return {
        label: "Refresh beads",
        action: () => catalogue.refreshFromApi(),
      };
    case "bead-types":
      return {
        label: "Refresh types",
        action: () => catalogue.refreshFromApi(),
      };
    case "bead-sizes":
      return {
        label: "Refresh sizes",
        action: () => catalogue.refreshFromApi(),
      };
    case "wrist-sizes":
      return {
        label: "Refresh wrist sizes",
        action: () => catalogue.refreshFromApi(),
      };
    case "general-settings":
      return {
        label: "Reload settings",
        action: async () => {},
      };
    case "sunglasses-config":
      return {
        label: "Refresh lens tints",
        action: () => sunglasses.refreshAdminFromApi(),
      };
    default:
      return {
        label: "Refresh",
        action: async () => {},
      };
  }
}
