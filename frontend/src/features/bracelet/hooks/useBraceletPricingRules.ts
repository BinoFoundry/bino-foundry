import { useEffect, useState } from "react";

import { DEFAULT_BRACELET_PRICING_RULES, type BraceletPricingRules } from "@bino-foundry/shared/types";

import { braceletApi } from "@/services/api/bracelet";
import { parseBraceletPricingRules } from "../pricing";

export function useBraceletPricingRules() {
  const [rules, setRules] = useState<BraceletPricingRules>(DEFAULT_BRACELET_PRICING_RULES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const remote = await braceletApi.getPricingRules();
        if (!cancelled) setRules(parseBraceletPricingRules(remote));
      } catch {
        if (!cancelled) setRules(DEFAULT_BRACELET_PRICING_RULES);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { rules, loading };
}
