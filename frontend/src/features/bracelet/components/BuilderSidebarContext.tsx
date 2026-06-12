import { ClipboardCopy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { WristSizeEntry } from "@/types/wrist-sizes";

import { BRACELET_COPY } from "../copy";
import type { BraceletBuilderActionsProps } from "./BraceletBuilderActions";
import { WristSizeSlider } from "./WristSizeSlider";

export interface BuilderSidebarContextProps {
  wristSizeCm: number;
  wristSizeCmB?: number;
  twinning?: boolean;
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
  wristSizes,
  wristSizeIdA,
  wristSizeIdB,
  onSelectWristA,
  onSelectWristB,
  builderActions,
}: BuilderSidebarContextProps) {
  return (
    <div className="space-y-3">
      <WristSizeSlider
        sizes={wristSizes}
        selectedId={wristSizeIdA}
        onSelect={onSelectWristA}
        label={BRACELET_COPY.currentWristSize}
      />

      {twinning && onSelectWristB ? (
        <WristSizeSlider
          sizes={wristSizes}
          selectedId={wristSizeIdB ?? null}
          onSelect={onSelectWristB}
          label={BRACELET_COPY.wristTwinB}
        />
      ) : null}

      {builderActions ? (
        <div className="space-y-2 border-t border-border/50 pt-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {BRACELET_COPY.matchingPairTitle}
            </p>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "text-[10px] font-medium uppercase tracking-wide",
                  !twinning ? "text-foreground" : "text-muted-foreground",
                )}
              >
                Off
              </span>
              <Switch
                checked={twinning}
                onCheckedChange={() => builderActions.onToggleTwinning()}
                aria-label={BRACELET_COPY.matchingPairTitle}
                className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-input"
              />
              <span
                className={cn(
                  "text-[10px] font-medium uppercase tracking-wide",
                  twinning ? "text-foreground" : "text-muted-foreground",
                )}
              >
                On
              </span>
            </div>
          </div>
          {twinning && builderActions.onDuplicateToB ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-7 w-full justify-start text-[11px]"
              title={BRACELET_COPY.duplicateToPairHint}
              disabled={builderActions.duplicateDisabled}
              onClick={builderActions.onDuplicateToB}
            >
              <ClipboardCopy className="mr-1.5 h-3.5 w-3.5" />
              {BRACELET_COPY.duplicateToPair}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
