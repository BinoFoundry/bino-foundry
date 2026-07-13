import type { CatalogAvailabilityStatus } from "@/types/catalog-availability";
import type { BeadLibraryEntry, BeadTypeEntry, SubBeadTypeEntry } from "@/types/beads";
import type { BeadSizeEntry } from "@/types/bead-sizes";
import type { WristSizeEntry } from "@/types/wrist-sizes";
import type { BeadLibrarySizeOffer } from "@/types/bead-library-sizes";
import type { FrameEntry } from "@/types/catalogue";
import type { BeadTagEntry } from "@/types/tags";
import type { HowWePrepareOption, StrandRenderProfile } from "@bino-foundry/shared/types";

export const CATALOGUE_STORAGE_KEY = "bino_catalogue_v8";

export interface CatalogueStore {
  /** Full taxonomy — includes inactive rows (admin). */
  beadTypes: BeadTypeEntry[];
  subBeadTypes: SubBeadTypeEntry[];
  beadLibraries: BeadLibraryEntry[];
  /** Builder-visible taxonomy — API filtered (`?forBuilder=1`). */
  builderBeadTypes: BeadTypeEntry[];
  builderSubBeadTypes: SubBeadTypeEntry[];
  builderBeadLibraries: BeadLibraryEntry[];
  beadSizes: BeadSizeEntry[];
  wristSizes: WristSizeEntry[];
  beadLibrarySizes: BeadLibrarySizeOffer[];
  catalogAvailabilityStatuses: CatalogAvailabilityStatus[];
  /** @deprecated Use catalogAvailabilityStatuses */
  beadAvailabilityStatuses: CatalogAvailabilityStatus[];
  frames: FrameEntry[];
  strandRenderDefaults: StrandRenderProfile | null;
  howWePrepareOptions: HowWePrepareOption[];
  beadTags: BeadTagEntry[];
}

export function loadFromStorage(): Partial<CatalogueStore> {
  return {};
}

export function saveToStorage(_data: CatalogueStore): void {
  // Catalogue state is API-driven; local persistence intentionally disabled.
}

export function createInitialCatalogueStore(): CatalogueStore {
  return {
    beadTypes: [],
    subBeadTypes: [],
    beadLibraries: [],
    builderBeadTypes: [],
    builderSubBeadTypes: [],
    builderBeadLibraries: [],
    beadSizes: [],
    wristSizes: [],
    beadLibrarySizes: [],
    catalogAvailabilityStatuses: [],
    beadAvailabilityStatuses: [],
    frames: [],
    strandRenderDefaults: null,
    howWePrepareOptions: [],
    beadTags: [],
  };
}

let snapshot: CatalogueStore = createInitialCatalogueStore();

export function getCatalogueSnapshot(): CatalogueStore {
  return snapshot;
}

export function syncCatalogueSnapshot(next: CatalogueStore): void {
  snapshot = next;
}

/** Resolve bead type slug from id. */
export function beadTypeSlugById(types: BeadTypeEntry[], typeId: string | undefined): string | undefined {
  if (!typeId) return undefined;
  return types.find((t) => t.id === typeId)?.slug;
}
