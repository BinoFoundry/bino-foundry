import type { SaveDesignRequest, SavedDesignSummary } from "@bino-foundry/shared/types";

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
    }[];
    subtotal: number;
    currencyCode: string;
  };
  sunglasses?: {
    id: string;
    frameId: string;
    lensTintId: string;
    selectedOptions: Record<string, boolean>;
    builderStep: string;
    subtotal: number;
    currencyCode: string;
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

  duplicate(id: string): Promise<SavedDesignSummary> {
    return apiRequestData<SavedDesignSummary>(`/designs/${encodeURIComponent(id)}/duplicate`, {
      method: "POST",
      body: {},
    });
  },
};
