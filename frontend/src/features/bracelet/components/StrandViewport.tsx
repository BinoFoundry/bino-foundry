import type { ReactNode, RefObject } from "react";

import type { StrandPan } from "../hooks/useStrandZoom";

interface StrandViewportProps {
  viewportRef: RefObject<HTMLDivElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  pan: StrandPan;
  panMode: boolean;
  isPanning: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
  children: ReactNode;
}

/**
 * Transformed layer holding strand canvases.
 * Pan uses viewport-level pointer handlers with hit-testing — no full-screen overlay,
 * so beads and drop targets stay interactive while pan mode is on.
 */
export function StrandViewport({
  viewportRef,
  contentRef,
  pan,
  panMode,
  isPanning,
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
      className={`relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden ${
        panMode ? (isPanning ? "cursor-grabbing" : "cursor-grab") : ""
      }`}
      onPointerDown={panMode ? onPointerDown : undefined}
      onPointerMove={panMode ? onPointerMove : undefined}
      onPointerUp={panMode ? onPointerUp : undefined}
      onPointerCancel={panMode ? onPointerCancel : undefined}
    >
      <div
        ref={contentRef}
        className="inline-flex w-max max-w-none flex-wrap items-center justify-center gap-4 sm:gap-6"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px)`,
          transition: isPanning ? undefined : "transform 80ms ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}
