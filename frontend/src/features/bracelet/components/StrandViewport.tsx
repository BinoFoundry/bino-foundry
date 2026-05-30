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

/** Transformed layer holding strand canvases; pan uses a full-area overlay in pan mode. */
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
      className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden"
    >
      {panMode ? (
        <div
          className={`absolute inset-0 z-20 touch-none ${isPanning ? "cursor-grabbing" : "cursor-grab"}`}
          aria-hidden
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        />
      ) : null}

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
