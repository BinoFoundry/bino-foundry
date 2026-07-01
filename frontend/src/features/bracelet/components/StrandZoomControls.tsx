import { Hand, HelpCircle, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BRACELET_COPY } from "../copy";
import { STRAND_ZOOM_MAX, STRAND_ZOOM_MIN } from "../hooks/useStrandZoom";

interface StrandZoomControlsProps {
  zoom: number;
  panMode: boolean;
  onTogglePan: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onShowTips?: () => void;
  className?: string;
}

export function StrandZoomControls({
  zoom,
  panMode,
  onTogglePan,
  onZoomIn,
  onZoomOut,
  onReset,
  onShowTips,
  className,
}: StrandZoomControlsProps) {
  return (
    <div
      role="toolbar"
      aria-label={BRACELET_COPY.zoomWheel}
      className={cn(
        "flex items-center gap-1 rounded-lg border border-border/50 bg-background/85 p-1 backdrop-blur-sm",
        className,
      )}
    >
      <Button
        type="button"
        variant={panMode ? "secondary" : "ghost"}
        size="icon"
        className="h-10 w-10 sm:h-8 sm:w-8"
        aria-label={panMode ? BRACELET_COPY.panModeOff : BRACELET_COPY.panModeOn}
        aria-pressed={panMode}
        title={panMode ? BRACELET_COPY.panModeOff : BRACELET_COPY.panModeOn}
        onClick={onTogglePan}
      >
        <Hand className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-10 w-10 sm:h-8 sm:w-8"
        aria-label={BRACELET_COPY.zoomOut}
        title={BRACELET_COPY.zoomOut}
        onClick={onZoomOut}
        disabled={zoom <= STRAND_ZOOM_MIN}
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
      <span
        className="min-w-[3rem] text-center text-[10px] tabular-nums text-muted-foreground"
        title={BRACELET_COPY.zoomWheel}
      >
        {Math.round(zoom * 100)}%
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-10 w-10 sm:h-8 sm:w-8"
        aria-label={BRACELET_COPY.zoomIn}
        title={BRACELET_COPY.zoomIn}
        onClick={onZoomIn}
        disabled={zoom >= STRAND_ZOOM_MAX}
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-10 w-10 sm:h-8 sm:w-8"
        aria-label={BRACELET_COPY.zoomReset}
        title={BRACELET_COPY.zoomReset}
        onClick={onReset}
      >
        <Maximize2 className="h-4 w-4" />
      </Button>
      {onShowTips ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 sm:h-8 sm:w-8"
          aria-label={BRACELET_COPY.dragOnboardingHelpTitle}
          title={BRACELET_COPY.dragOnboardingHelpTitle}
          onClick={onShowTips}
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}
