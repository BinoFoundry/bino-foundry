import { Link2, Unlink2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { BRACELET_COPY } from "../copy";
import type { BraceletBuilderActionsProps } from "./BraceletBuilderActions";

interface MatchingPairControlsProps {
  twinning: boolean;
  braceletBMatched: boolean;
  builderActions: BraceletBuilderActionsProps;
  className?: string;
  touchFriendly?: boolean;
}

/** Matching pair toggle + one-shot match / unmatch copy controls. */
export function MatchingPairControls({
  twinning,
  braceletBMatched,
  builderActions,
  className,
  touchFriendly = false,
}: MatchingPairControlsProps) {
  const textSize = touchFriendly ? "text-xs" : "text-[10px]";

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <p
          className={cn(
            "min-w-0 font-medium uppercase tracking-[0.12em] text-muted-foreground",
            touchFriendly ? "text-[10px]" : "text-[9px]",
          )}
        >
          {BRACELET_COPY.matchingPairTitle}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <span
            className={cn(
              "font-medium uppercase tracking-wide",
              touchFriendly ? "text-[10px]" : "text-[9px]",
              !twinning ? "text-foreground" : "text-muted-foreground",
            )}
          >
            Off
          </span>
          <Switch
            checked={twinning}
            onCheckedChange={() => builderActions.onToggleTwinning()}
            aria-label={BRACELET_COPY.matchingPairTitle}
            className={cn(
              "shrink-0 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
              touchFriendly
                ? "h-6 w-11 [&>span]:h-5 [&>span]:w-5 data-[state=checked]:[&>span]:translate-x-5"
                : "h-5 w-9 [&>span]:h-4 [&>span]:w-4 data-[state=checked]:[&>span]:translate-x-4",
            )}
          />
          <span
            className={cn(
              "font-medium uppercase tracking-wide",
              touchFriendly ? "text-[10px]" : "text-[9px]",
              twinning ? "text-foreground" : "text-muted-foreground",
            )}
          >
            On
          </span>
        </div>
      </div>

      {twinning ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={cn("w-full", touchFriendly ? "px-2.5" : "px-2")}
          disabled={!braceletBMatched && builderActions.matchDisabled}
          onClick={braceletBMatched ? builderActions.onUnmatchBracelets : builderActions.onMatchBracelets}
        >
          <span className={cn("inline-flex items-center gap-1.5 font-medium", textSize)}>
            {braceletBMatched ? (
              <Unlink2 className={cn(touchFriendly ? "h-3.5 w-3.5" : "h-3 w-3")} />
            ) : (
              <Link2 className={cn(touchFriendly ? "h-3.5 w-3.5" : "h-3 w-3")} />
            )}
            {braceletBMatched ? BRACELET_COPY.unmatchBracelets : BRACELET_COPY.matchBracelets}
          </span>
        </Button>
      ) : null}
    </div>
  );
}
