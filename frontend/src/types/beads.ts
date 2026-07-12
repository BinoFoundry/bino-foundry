import type { BeadCropConfig, BeadCropStatus } from "@bino-foundry/shared/types";

import type { BeadTagEntry } from "@/types/tags";

export type { BeadCropConfig, BeadCropStatus };

/** Dynamic bead category (Crystal, Charm, Spacer, …). */
export interface BeadTypeEntry {
  id: string;
  slug: string;
  name: string;
  description: string;
  displayOrder?: number;
  isActive?: boolean;
  enableSubTypes?: boolean;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

/** Second-level grouping within a bead type (e.g. Crystal → Quartz). */
export interface SubBeadTypeEntry {
  id: string;
  beadTypeId: string;
  beadTypeSlug?: string;
  beadTypeName?: string;
  slug: string;
  name: string;
  description: string;
  displayOrder?: number;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

/** Unified bracelet bead catalogue item. */
export interface BeadLibraryEntry {
  id: string;
  name: string;
  /** Display URL (processed when ready, else original). */
  image: string;
  originalImage?: string;
  processedImage?: string;
  beadTypeId: string;
  beadTypeSlug?: string;
  subBeadTypeId?: string;
  subBeadTypeSlug?: string;
  subBeadTypeName?: string;
  description: string;
  metadata?: Record<string, unknown>;
  cropConfig?: BeadCropConfig | null;
  cropStatus?: BeadCropStatus;
  /** Database-driven lifecycle code (e.g. ACTIVE, INACTIVE). */
  availabilityStatusCode?: string;
  isActive?: boolean;
  displayOrder?: number;
  /** Reusable catalogue tags for search and merchandising. */
  tags?: BeadTagEntry[];
  tagSlugs?: string[];
  createdAt?: string;
  updatedAt?: string;
}
