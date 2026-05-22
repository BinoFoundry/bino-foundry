import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

import {
  autoMaskOptionsForView,
  renderMaskedViewToCanvas,
  tintParamsFromGradient,
} from "../engine/canvas/canvas-render-pipeline";
import type { CompositorView } from "../types";
import type { MaskedViewInput } from "../engine/canvas/canvas-render-pipeline";
import { CompositorViewport, type CompositorAspectRatio } from "./CompositorViewport";

export interface CanvasCompositorViewProps {
  view: CompositorView;
  plate: MaskedViewInput | null;
  tintTop: string;
  tintBottom: string;
  lensOpacity?: number;
  aspectRatio?: CompositorAspectRatio;
  label?: string;
  className?: string;
}

/**
 * @deprecated Sunglasses customiser uses {@link SvgClipCompositorView} (SVG clipPath). Kept for legacy tooling only.
 */
export function CanvasCompositorView({
  view,
  plate,
  tintTop,
  tintBottom,
  lensOpacity = 0.88,
  aspectRatio = "16/10",
  label,
  className,
}: CanvasCompositorViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !plate?.plateUrl) return;

    let cancelled = false;

    void (async () => {
      try {
        await renderMaskedViewToCanvas(
          canvas,
          {
            ...plate,
            autoMaskOptions: autoMaskOptionsForView(view),
          },
          tintParamsFromGradient(tintTop, tintBottom, lensOpacity),
        );
      } catch (err) {
        if (!cancelled) console.error("Canvas render failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [plate, tintTop, tintBottom, lensOpacity, view]);

  return (
    <CompositorViewport aspectRatio={aspectRatio} label={label} className={className}>
      <div className={cn("relative flex h-full w-full items-center justify-center bg-muted/20")}>
        {plate?.plateUrl ? (
          <canvas ref={canvasRef} className="max-h-full max-w-full object-contain" />
        ) : (
          <p className="text-sm text-muted-foreground">No {view} plate configured</p>
        )}
      </div>
    </CompositorViewport>
  );
}
