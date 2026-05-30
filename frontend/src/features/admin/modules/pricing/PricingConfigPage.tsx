import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SunglassesCatalogAdmin } from "@/components/admin/SunglassesCatalogAdmin";

import { BraceletPricingAdmin } from "./BraceletPricingAdmin";

type PricingTab = "sunglasses" | "bracelet";

export function PricingConfigPage() {
  const [tab, setTab] = useState<PricingTab>("sunglasses");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 gap-2 border-b border-border px-4 py-3 sm:px-6">
        {(
          [
            ["sunglasses", "Sunglasses"],
            ["bracelet", "Bracelet"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            size="sm"
            variant={tab === id ? "default" : "outline"}
            onClick={() => setTab(id)}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "sunglasses" ? <SunglassesCatalogAdmin /> : <BraceletPricingAdmin />}
      </div>
    </div>
  );
}
