import type { BraceletPricingRules } from "@bino-foundry/shared/types";

import { apiRequest } from "./client";

export type BraceletPricingRulesPayload = BraceletPricingRules & {
  description?: string;
};

export interface SavedBraceletConfiguration {
  id: string;
  status: string;
  subtotal: number;
  currencyCode: string;
  itemCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateBraceletConfigBody {
  twinning: boolean;
  wristSizeCmA: number;
  wristSizeCmB: number;
  defaultBeadSizeMm: number;
  status?: "draft" | "saved";
  items: {
    strandIndex: 0 | 1;
    slotPosition: number;
    beadLibraryId: string;
    beadSizeMm: number;
  }[];
}

export const braceletApi = {
  getPricingRules(): Promise<BraceletPricingRulesPayload> {
    return apiRequest<BraceletPricingRulesPayload>("/bracelet/pricing-rules");
  },

  updatePricingRules(rules: BraceletPricingRulesPayload): Promise<BraceletPricingRulesPayload> {
    return apiRequest<BraceletPricingRulesPayload>("/bracelet/pricing-rules", {
      method: "PUT",
      body: rules,
    });
  },

  saveConfiguration(body: CreateBraceletConfigBody): Promise<SavedBraceletConfiguration> {
    return apiRequest<SavedBraceletConfiguration>("/bracelet/configurations", {
      method: "POST",
      body,
    });
  },

  getConfiguration(id: string): Promise<unknown> {
    return apiRequest(`/bracelet/configurations/${encodeURIComponent(id)}`);
  },
};
