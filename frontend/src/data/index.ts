/**
 * Backward-compatible re-exports — prefer `@/state/catalogue` and `@/types/catalogue` in new code.
 */
export { DEFAULT_CRYSTALS } from "./crystals";
export { DEFAULT_FRAMES } from "./glasses";

export {
  useCatalogue,
  getCatalogueSnapshot,
  type CatalogueState,
} from "@/state/catalogue";

export type { TypeEntry } from "@/types/catalogue";
export type { CrystalEntry } from "@/data/crystals";
export type { FrameEntry } from "@/data/glasses";
export type { CharmEntry, SpacerEntry, CharmTypeEntry, SpacerTypeEntry } from "@/types/catalogue";
