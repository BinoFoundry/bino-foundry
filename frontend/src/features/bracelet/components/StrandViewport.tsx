import type { ReactNode, RefObject } from "react";

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
        className="inline-flex w-max max-w-none flex-wrap items-center justify-center gap-1 sm:gap-1.5"
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
