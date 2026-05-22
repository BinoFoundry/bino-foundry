/**
 * Backward-compatible re-exports — prefer `@/state/catalogue` and `@/types/beads` in new code.
 */
export { DEFAULT_CRYSTALS } from "./crystals";
export { DEFAULT_FRAMES } from "./glasses";

export {
  useCatalogue,
  getCatalogueSnapshot,
  type CatalogueState,
} from "@/state/catalogue";

export type { FrameEntry } from "@/data/glasses";
export type { CrystalEntry } from "@/data/crystals";
export type { BeadLibraryEntry, BeadTypeEntry } from "@/types/beads";
