import { ClipboardCopy, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

import { BRACELET_COPY } from "../copy";

export interface BraceletBuilderActionsProps {
  twinning: boolean;
  onToggleTwinning: () => void;
  onDuplicateToB?: () => void;
  duplicateDisabled?: boolean;
}

export function BraceletBuilderActions({
  twinning,
  onToggleTwinning,
  onDuplicateToB,
  duplicateDisabled = false,
}: BraceletBuilderActionsProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="h-8 w-full justify-start text-[11px]"
        onClick={onToggleTwinning}
      >
        <Copy className="mr-2 h-3.5 w-3.5" />
        {twinning ? "Single bracelet" : BRACELET_COPY.twinOff}
      </Button>
      {twinning && onDuplicateToB ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8 w-full justify-start text-[11px]"
          title={BRACELET_COPY.duplicateToPairHint}
          disabled={duplicateDisabled}
          onClick={onDuplicateToB}
        >
          <ClipboardCopy className="mr-2 h-3.5 w-3.5" />
          {BRACELET_COPY.duplicateToPair}
        </Button>
      ) : null}
    </div>
  );
}
