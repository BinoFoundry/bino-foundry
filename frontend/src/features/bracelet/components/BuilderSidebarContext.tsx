import type { WristSizeEntry } from "@/types/wrist-sizes";

import { BRACELET_COPY } from "../copy";
import type { BraceletBuilderActionsProps } from "./BraceletBuilderActions";
import { MatchingPairControls } from "./MatchingPairControls";
import { WristSizeSlider } from "./WristSizeSlider";

export interface BuilderSidebarContextProps {
  wristSizeCm: number;
  wristSizeCmB?: number;
  twinning?: boolean;
  braceletBMatched?: boolean;
  wristSizes: WristSizeEntry[];
  wristSizeIdA: string | null;
  wristSizeIdB?: string | null;
  onSelectWristA: (entry: WristSizeEntry) => void;
  onSelectWristB?: (entry: WristSizeEntry) => void;
  builderActions?: BraceletBuilderActionsProps;
}

/** Compact wrist slider + matching-pair toggle for the left discovery sidebar. */
export function BuilderSidebarContext({
  twinning = false,
  braceletBMatched = false,
  wristSizes,
  wristSizeIdA,
  wristSizeIdB,
  onSelectWristA,
  onSelectWristB,
  builderActions,
}: BuilderSidebarContextProps) {
  return (
    <div className="space-y-2">
      <WristSizeSlider
        compact
        sizes={wristSizes}
        selectedId={wristSizeIdA}
        onSelect={onSelectWristA}
        label={BRACELET_COPY.currentWristSize}
      />

      {twinning && onSelectWristB ? (
        <WristSizeSlider
          compact
          sizes={wristSizes}
          selectedId={wristSizeIdB ?? null}
          onSelect={onSelectWristB}
          label={BRACELET_COPY.wristTwinB}
        />
      ) : null}

      {builderActions ? (
        <MatchingPairControls
          twinning={twinning}
          braceletBMatched={braceletBMatched}
          builderActions={builderActions}
          className="border-t border-border/50 pt-1.5"
        />
      ) : null}
    </div>
  );
}
