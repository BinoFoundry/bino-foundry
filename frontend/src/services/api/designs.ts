import type {
  BulkDeleteDesignsResult,
  SaveDesignRequest,
  SavedDesignSummary,
} from "@bino-foundry/shared/types";

import { apiRequestData } from "./client";

export interface SavedDesignDetail extends SavedDesignSummary {
  bracelet?: {
    id: string;
    status: string;
    twinning: boolean;
    wristSizeCmA: number;
    wristSizeCmB: number;
    items: {
      strandIndex: 0 | 1;
      slotPosition: number;
      beadLibraryId: string;
      beadSizeMm: number;
      offerKey?: string;
      beadName?: string;
      catalogIssue?: "deleted" | "unavailable" | null;
      unitPrice?: number;
      /** Turned around by hand when saved. */
      flipped?: boolean;
      /** Halo attached to this bead; wraps it rather than taking a slot. */
      frame?: {
        beadLibraryId: string;
        beadSizeMm: number;
        offerKey?: string;
        beadName?: string;
        sizeLabel?: string;
        unitPrice?: number;
      };
    }[];
    subtotal: number;
    currencyCode: string;
    catalogWarnings?: {
      missingBeadIds?: string[];
      unavailableBeadIds?: string[];
      inactiveBeadIds?: string[];
    };
    hasCatalogIssues?: boolean;
  };
  sunglasses?: {
    id: string;
    frameId: string;
    frameName?: string;
    lensTintId: string;
    selectedOptions: Record<string, boolean>;
    builderStep: string;
    subtotal: number;
    currencyCode: string;
    catalogIssue?: "deleted" | "unavailable" | null;
    catalogWarnings?: {
      missingFrameIds?: string[];
      unavailableFrameIds?: string[];
    };
    hasCatalogIssues?: boolean;
  };
}

export const designsApi = {
  list(): Promise<SavedDesignSummary[]> {
    return apiRequestData<SavedDesignSummary[]>("/designs");
  },

  get(id: string): Promise<SavedDesignDetail> {
    return apiRequestData<SavedDesignDetail>(`/designs/${encodeURIComponent(id)}`);
  },

  save(body: SaveDesignRequest & { designId?: string }): Promise<SavedDesignSummary> {
    return apiRequestData<SavedDesignSummary>("/designs", { method: "POST", body });
  },

  remove(id: string): Promise<void> {
    return apiRequestData<void>(`/designs/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  bulkRemove(designIds: string[]): Promise<BulkDeleteDesignsResult> {
    return apiRequestData<BulkDeleteDesignsResult>("/designs/bulk-delete", {
      method: "POST",
      body: { designIds },
    });
  },

  duplicate(id: string): Promise<SavedDesignSummary> {
    return apiRequestData<SavedDesignSummary>(`/designs/${encodeURIComponent(id)}/duplicate`, {
      method: "POST",
      body: {},
    });
  },
};
