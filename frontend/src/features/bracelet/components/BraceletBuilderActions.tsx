import { ClipboardCopy, Copy, Library } from "lucide-react";

import { Button } from "@/components/ui/button";

import { BRACELET_COPY } from "../copy";

export interface BraceletBuilderActionsProps {
  libraryOpen: boolean;
  onToggleLibrary: () => void;
  twinning: boolean;
  onToggleTwinning: () => void;
  onDuplicateToB?: () => void;
  duplicateDisabled?: boolean;
}

export function BraceletBuilderActions({
  libraryOpen,
  onToggleLibrary,
  twinning,
  onToggleTwinning,
  onDuplicateToB,
  duplicateDisabled = false,
}: BraceletBuilderActionsProps) {
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant={libraryOpen ? "default" : "secondary"}
        size="sm"
        className="w-full justify-start text-xs"
        onClick={onToggleLibrary}
      >
        <Library className="mr-2 h-3.5 w-3.5" />
        {BRACELET_COPY.library}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="w-full justify-start text-xs"
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
          className="w-full justify-start text-xs"
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
