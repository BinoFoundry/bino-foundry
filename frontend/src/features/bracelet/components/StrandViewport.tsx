import type { ReactNode, RefObject } from "react";

import { cn } from "@/lib/utils";

import type { MatchingPairLayout } from "../strand-camera";
import type { StrandPan } from "../hooks/useStrandZoom";

interface StrandViewportProps {
  viewportRef: RefObject<HTMLDivElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  pan: StrandPan;
  isPanning: boolean;
  /** Combined auto-fit + user zoom — visual only, does not change layout coordinates. */
  viewScale?: number;
  /** When true, viewport shows grab cursor for dedicated pan mode. */
  panMode?: boolean;
  /** Side-by-side pair layout — both strands stay visible without wrapping. */
  twinning?: boolean;
  matchingPairLayout?: MatchingPairLayout;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
  children: ReactNode;
}

/**
 * Transformed layer holding strand canvases.
 * Pan only activates when pan mode is enabled via the toolbar.
 */
export function StrandViewport({
  viewportRef,
  contentRef,
  pan: _pan,
  isPanning,
  viewScale: _viewScale = 1,
  panMode = false,
  twinning = false,
  matchingPairLayout = "side-by-side",
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  children,
}: StrandViewportProps) {
  return (
    <div
      ref={viewportRef}
      data-strand-viewport
      className={`surface-canvas relative isolate flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden ${
        isPanning ? "cursor-grabbing" : panMode ? "cursor-grab" : "cursor-default"
      }`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div
        ref={contentRef}
        data-strand-viewport-content
        data-twinning={twinning ? "true" : "false"}
        className={cn(
          "inline-flex w-max max-w-none items-center justify-center",
          twinning
            ? matchingPairLayout === "stacked"
              ? "flex-col flex-nowrap gap-1.5 sm:gap-2"
              : "flex-row flex-nowrap gap-1.5 sm:gap-2 md:gap-3"
            : "flex-row flex-wrap gap-1 sm:gap-1.5",
        )}
        style={{
          transformOrigin: "center center",
          willChange: isPanning ? "transform" : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
