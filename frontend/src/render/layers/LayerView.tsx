import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

import { COMPOSITOR_TRANSITION_MS } from "../constants";

interface LayerViewProps {
  zIndex: number;
  opacity?: number;
  className?: string;
  children: ReactNode;
  pointerEvents?: boolean;
}

/** Absolute full-bleed layer slot (prototype `.layer` CSS). */
export function LayerView({
  zIndex,
  opacity = 1,
  className,
  children,
  pointerEvents = false,
}: LayerViewProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex items-center justify-center transition-all",
        pointerEvents ? "pointer-events-auto" : "pointer-events-none",
        className,
      )}
      style={{
        zIndex,
        opacity,
        transitionDuration: `${COMPOSITOR_TRANSITION_MS}ms`,
        transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {children}
    </div>
  );
}

