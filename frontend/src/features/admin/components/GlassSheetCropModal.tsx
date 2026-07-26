import { useEffect, useRef, useState } from "react";
import type { GlassSheetCropRect } from "@bino-foundry/shared/types";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type DragMode =
  | null
  | "move"
  | "pan"
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function normalizeCrop(crop: GlassSheetCropRect): GlassSheetCropRect {
  const width = clamp(crop.width, 0.05, 1);
  const height = clamp(crop.height, 0.05, 1);
  return {
    x: clamp(crop.x, 0, 1 - width),
    y: clamp(crop.y, 0, 1 - height),
    width,
    height,
  };
}

interface GlassSheetCropModalProps {
  open: boolean;
  imageUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  initialCrop?: GlassSheetCropRect | null;
  onConfirm: (crop: GlassSheetCropRect) => void;
  onCancel: () => void;
}

/**
 * Visual crop editor for glass sheets — drag, resize, zoom, and pan.
 * Crop is stored as a normalized 0–1 rectangle of the natural image.
 */
export function GlassSheetCropModal({
  open,
  imageUrl,
  naturalWidth,
  naturalHeight,
  initialCrop,
  onConfirm,
  onCancel,
}: GlassSheetCropModalProps) {
  const imageBoxRef = useRef<HTMLDivElement>(null);
  const [crop, setCrop] = useState<GlassSheetCropRect>(() =>
    normalizeCrop(initialCrop ?? { x: 0.1, y: 0.1, width: 0.8, height: 0.8 }),
  );
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{
    mode: NonNullable<DragMode>;
    startX: number;
    startY: number;
    startCrop: GlassSheetCropRect;
    startPan: { x: number; y: number };
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setCrop(normalizeCrop(initialCrop ?? { x: 0.1, y: 0.1, width: 0.8, height: 0.8 }));
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [open, imageUrl, initialCrop]);

  const toNorm = (clientX: number, clientY: number) => {
    const box = imageBoxRef.current;
    if (!box) return { x: 0, y: 0 };
    const rect = box.getBoundingClientRect();
    return {
      x: clamp((clientX - rect.left) / Math.max(1, rect.width), 0, 1),
      y: clamp((clientY - rect.top) / Math.max(1, rect.height), 0, 1),
    };
  };

  const beginDrag = (mode: NonNullable<DragMode>) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: crop,
      startPan: { ...pan },
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;

    if (drag.mode === "pan") {
      setPan({
        x: drag.startPan.x + (e.clientX - drag.startX),
        y: drag.startPan.y + (e.clientY - drag.startY),
      });
      return;
    }

    const start = toNorm(drag.startX, drag.startY);
    const current = toNorm(e.clientX, e.clientY);
    const dx = current.x - start.x;
    const dy = current.y - start.y;
    const sc = drag.startCrop;
    const next = { ...sc };

    if (drag.mode === "move") {
      next.x = sc.x + dx;
      next.y = sc.y + dy;
    } else {
      if (drag.mode.includes("e")) next.width = sc.width + dx;
      if (drag.mode.includes("s")) next.height = sc.height + dy;
      if (drag.mode.includes("w")) {
        next.x = sc.x + dx;
        next.width = sc.width - dx;
      }
      if (drag.mode.includes("n")) {
        next.y = sc.y + dy;
        next.height = sc.height - dy;
      }
    }

    setCrop(normalizeCrop(next));
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const handles: Array<{ mode: NonNullable<DragMode>; className: string }> = [
    { mode: "nw", className: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize" },
    { mode: "n", className: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize" },
    { mode: "ne", className: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize" },
    { mode: "e", className: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize" },
    { mode: "se", className: "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize" },
    { mode: "s", className: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize" },
    { mode: "sw", className: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize" },
    { mode: "w", className: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize" },
  ];

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onCancel() : undefined)}>
      <DialogContent className="max-w-3xl gap-3 sm:rounded-lg">
        <DialogHeader>
          <DialogTitle>Crop glass sheet</DialogTitle>
          <DialogDescription>
            Drag the frame to position it, use handles to resize, and zoom or pan for precision.
          </DialogDescription>
        </DialogHeader>

        <div
          className="relative h-[min(60vh,420px)] w-full overflow-hidden rounded-md border border-border bg-[#121216] touch-none"
          onPointerDown={beginDrag("pan")}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center center",
            }}
          >
            <div
              ref={imageBoxRef}
              className="relative max-h-full max-w-full"
              style={{ aspectRatio: `${Math.max(1, naturalWidth)} / ${Math.max(1, naturalHeight)}` }}
            >
              <img
                src={imageUrl}
                alt="Glass sheet"
                draggable={false}
                className="block h-auto max-h-[min(60vh,420px)] w-auto max-w-full select-none object-contain"
              />
              <div
                className="absolute border-2 border-emerald-400 bg-emerald-400/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
                style={{
                  left: `${crop.x * 100}%`,
                  top: `${crop.y * 100}%`,
                  width: `${crop.width * 100}%`,
                  height: `${crop.height * 100}%`,
                }}
                onPointerDown={beginDrag("move")}
              >
                {handles.map((h) => (
                  <button
                    key={h.mode}
                    type="button"
                    aria-label={`Resize ${h.mode}`}
                    className={cn(
                      "absolute h-3 w-3 rounded-sm border border-emerald-200 bg-emerald-400",
                      h.className,
                    )}
                    onPointerDown={beginDrag(h.mode)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs text-muted-foreground">Zoom</Label>
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={100}
            max={300}
            step={1}
            value={Math.round(zoom * 100)}
            onChange={(e) => setZoom(Number(e.target.value) / 100)}
            className="w-full accent-foreground"
          />
          <p className="text-[10px] text-muted-foreground">
            Drag empty space to pan. Drag the crop frame to move; corners and edges resize.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={() => onConfirm(normalizeCrop(crop))}>
            Apply crop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
