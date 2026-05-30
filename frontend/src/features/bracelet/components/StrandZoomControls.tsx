import { Hand, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BRACELET_COPY } from "../copy";
import { STRAND_ZOOM_MAX, STRAND_ZOOM_MIN } from "../hooks/useStrandZoom";

interface StrandZoomControlsProps {
  zoom: number;
  panMode: boolean;
  canPan: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onTogglePanMode: () => void;
  className?: string;
}

export function StrandZoomControls({
  zoom,
  panMode,
  canPan,
  onZoomIn,
  onZoomOut,
  onReset,
  onTogglePanMode,
  className,
}: StrandZoomControlsProps) {
  return (
    <div
      role="toolbar"
      aria-label={BRACELET_COPY.zoomWheel}
      className={`flex items-center gap-1 rounded-lg border border-border/80 bg-background/90 p-1 shadow-sm backdrop-blur-sm ${className ?? ""}`}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
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
        className="h-8 w-8"
        title={BRACELET_COPY.zoomIn}
        onClick={onZoomIn}
        disabled={zoom >= STRAND_ZOOM_MAX}
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={panMode ? "secondary" : "ghost"}
        size="icon"
        className="h-8 w-8"
        title={canPan ? (panMode ? BRACELET_COPY.panModeOff : BRACELET_COPY.panModeOn) : BRACELET_COPY.panRequiresZoom}
        aria-pressed={panMode}
        onClick={onTogglePanMode}
        disabled={!canPan}
      >
        <Hand className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title={BRACELET_COPY.zoomReset}
        onClick={onReset}
      >
        <Maximize2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
