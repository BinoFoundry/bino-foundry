import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { WristSizeEntry } from "@/types/wrist-sizes";

import { BRACELET_COPY } from "../copy";
import { WristSizePickerCards } from "./WristSizePickerCards";

interface BraceletMobileConfigBarProps {
  wristSizeCm: number;
  wristSizeCmB?: number;
  twinning?: boolean;
  wristSizes: WristSizeEntry[];
  wristSizeIdA: string | null;
  wristSizeIdB?: string | null;
  onSelectWristA: (entry: WristSizeEntry) => void;
  onSelectWristB?: (entry: WristSizeEntry) => void;
  onOpenLibrary: () => void;
}

export function BraceletMobileConfigBar({
  wristSizeCm,
  wristSizeCmB,
  twinning = false,
  wristSizes,
  wristSizeIdA,
  wristSizeIdB,
  onSelectWristA,
  onSelectWristB,
  onOpenLibrary,
}: BraceletMobileConfigBarProps) {
  const [changingSize, setChangingSize] = useState(false);

  const wristLabel =
    twinning && wristSizeCmB != null ? `${wristSizeCm} · ${wristSizeCmB} cm` : `${wristSizeCm} cm`;

  return (
    <div className="shrink-0 border-b border-border bg-background/95 px-3 py-2 lg:hidden">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground">{BRACELET_COPY.wristSizeLabel}</p>
          <p className="type-body truncate font-medium">{wristLabel}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setChangingSize((o) => !o)}>
            {BRACELET_COPY.changeSize}
          </Button>
          <Button type="button" variant="secondary" size="sm" className="text-xs" onClick={onOpenLibrary}>
            {BRACELET_COPY.library}
          </Button>
        </div>
      </div>
      {changingSize ? (
        <div className="mt-3 space-y-3 rounded-xl border border-border/60 bg-muted/15 p-3">
          <WristSizePickerCards
            label={twinning ? BRACELET_COPY.wristTwinA : BRACELET_COPY.wristLabel}
            sizes={wristSizes}
            selectedId={wristSizeIdA}
            onSelect={onSelectWristA}
            variant="inline"
            scrollable={wristSizes.length > 8}
          />
          {twinning && onSelectWristB ? (
            <WristSizePickerCards
              label={BRACELET_COPY.wristTwinB}
              sizes={wristSizes}
              selectedId={wristSizeIdB ?? null}
              onSelect={onSelectWristB}
              variant="inline"
              scrollable={wristSizes.length > 8}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
