import { Button } from "@/components/ui/button";
import type { WristSizeEntry } from "@/types/wrist-sizes";

import { BRACELET_COPY } from "../copy";
import { WristSizeSlider } from "./WristSizeSlider";

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
  twinning = false,
  wristSizes,
  wristSizeIdA,
  wristSizeIdB,
  onSelectWristA,
  onSelectWristB,
  onOpenLibrary,
}: BraceletMobileConfigBarProps) {
  return (
    <div className="shrink-0 space-y-2 border-b border-border/60 bg-background/95 px-3 py-2 md:hidden">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <WristSizeSlider
            compact
            sizes={wristSizes}
            selectedId={wristSizeIdA}
            onSelect={onSelectWristA}
            label={BRACELET_COPY.currentWristSize}
          />
        </div>
        <Button type="button" variant="secondary" size="sm" className="mt-4 shrink-0 text-xs" onClick={onOpenLibrary}>
          {BRACELET_COPY.library}
        </Button>
      </div>
      {twinning && onSelectWristB ? (
        <WristSizeSlider
          compact
          sizes={wristSizes}
          selectedId={wristSizeIdB ?? null}
          onSelect={onSelectWristB}
          label={BRACELET_COPY.wristTwinB}
        />
      ) : null}
    </div>
  );
}
