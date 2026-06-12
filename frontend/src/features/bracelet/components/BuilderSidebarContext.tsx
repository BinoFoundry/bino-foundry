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
        <div className="space-y-1.5 border-t border-border/50 pt-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {BRACELET_COPY.matchingPairTitle}
            </p>
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  "text-[9px] font-medium uppercase tracking-wide",
                  !twinning ? "text-foreground" : "text-muted-foreground",
                )}
              >
                Off
              </span>
              <Switch
                checked={twinning}
                onCheckedChange={() => builderActions.onToggleTwinning()}
                aria-label={BRACELET_COPY.matchingPairTitle}
                className="h-5 w-9 shrink-0 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input [&>span]:h-4 [&>span]:w-4 data-[state=checked]:[&>span]:translate-x-4"
              />
              <span
                className={cn(
                  "text-[9px] font-medium uppercase tracking-wide",
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
              className="h-6 w-full justify-start px-2 text-[10px]"
              title={BRACELET_COPY.duplicateToPairHint}
              disabled={builderActions.duplicateDisabled}
              onClick={builderActions.onDuplicateToB}
            >
              <ClipboardCopy className="mr-1 h-3 w-3" />
              {BRACELET_COPY.duplicateToPair}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
