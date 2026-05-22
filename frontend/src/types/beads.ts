import type { BeadCropConfig, BeadCropStatus } from "@bino-foundry/shared/types";

export type { BeadCropConfig, BeadCropStatus };

/** Dynamic bead category (Crystal, Charm, Spacer, …). */
export interface BeadTypeEntry {
  id: string;
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
  price: number;
  /** Display URL (processed when ready, else original). */
  image: string;
  originalImage?: string;
  processedImage?: string;
  beadTypeId: string;
  beadTypeSlug?: string;
  description: string;
  metadata?: Record<string, unknown>;
  cropConfig?: BeadCropConfig | null;
  cropStatus?: BeadCropStatus;
  createdAt?: string;
  updatedAt?: string;
}
