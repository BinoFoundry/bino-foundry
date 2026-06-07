import { useState, useRef, useCallback, useMemo, useEffect, type KeyboardEvent } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { X } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragMoveEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { placedBeadSizeMm, type PlacedBead } from "@/lib/luxe-data";
import {
  getBeadImageUrl,
  getBeadSlotDimensions,
  getGuideSlotDimensions,
  getMaxSlotExtent,
  getPlacedBeadImageFilter,
  getPlacedBeadShellStyle,
  getStrandBeadImageStyle,
  getStrandBeadRasterSize,
  STRAND_CORD,
  type BeadSlotDimensions,
} from "@/render/bead-crop";
import { normalizeFromSlots, strandCircumferenceMm } from "@/features/bracelet/composition";
import {
  computeMaxRingRadiusPx,
  computeWristRingRadiusPx,
  type WristSizeBounds,
} from "@/features/bracelet/strand-ring";
import {
  computeElasticBeadLayout,
  resolveDropTargetFromLayout,
  type LayoutAngleSector,
} from "@/features/bracelet/strand-elastic-layout";
import {
  beadLayoutArcPx,
  computeResolvedRingRadiusPx,
} from "@/features/bracelet/strand-ring-geometry";
import type { LibraryDragPayload } from "@/components/BeadLibrary";
import { BRACELET_COPY } from "@/features/bracelet/copy";
import { BEAD_LIBRARY_DRAG_TYPE, isLibraryDragEvent } from "@/features/bracelet/interaction";
import {
  beadTypeRotationOffsetDeg,
  computeStrandBboxFillScale,
  computeStrandPathLayout,
  pointerAngleOnCanvas,
  STRAND_PATH_START_ANGLE,
  type StrandDropTarget,
} from "@/features/bracelet/strand-layout";
import {
  computeStrandContentBounds,
  shiftStrandLayoutToCanvasCenter,
  squareCanvasSizeForBounds,
  STRAND_CONTENT_PADDING_PX,
  STRAND_LAYOUT_BASELINE_PX,
  STRAND_MAX_LAYOUT_FILL,
  STRAND_RING_EDGE_PADDING_PX,
  STRAND_TARGET_BBOX_FILL,
} from "@/features/bracelet/strand-viewport";
import { cn } from "@/lib/utils";
import type { BeadLibraryEntry } from "@/types/beads";

type EmptySlotGuideMode = "prominent" | "moderate" | "none";

const REORDER_HINT_STORAGE_KEY = "bino-foundry-reorder-hint-dismissed";
const REORDER_HINT_AUTO_DISMISS_MS = 12_000;

function dropTargetKey(target: StrandDropTarget): string {
  return `${target.mode}:${target.index}:${target.anchorAngleRad ?? ""}`;
}

export interface LibraryDropPayload {
  bead?: BeadLibraryEntry;
  /** @deprecated Legacy drag key — same as sizeOfferKey. */
  variantId?: string;
  sizeOfferKey?: string;
  beadSizeMm?: number;
}

export type StrandDropHover = StrandDropTarget | null;

interface SortableCircularStrandProps {
  placedBeads: PlacedBead[];
  onBeadsReorder: (fromPosition: number, toPosition: number) => void;
  onSlotClick: (position: number) => void;
  onBeadDrop?: (target: StrandDropTarget, data: LibraryDropPayload) => void;
  onBeadRemove?: (position: number) => void;
  label?: string;
  wristSize: number;
  wristSizeBounds: WristSizeBounds;
  guideSizeMm: number;
  selectedPosition?: number | null;
  hoverDropTarget?: StrandDropHover;
  onHoverDropTarget?: (target: StrandDropHover) => void;
  libraryDragActive?: boolean;
  libraryDragPreview?: LibraryDragPayload | null;
  /** Ring start angle (radians) — first bead anchors here after empty-strand drop. */
  pathStartAngle?: number;
  size?: number;
  layoutKey?: string | number;
}

/** Outward radial offset from ring center, expressed in bead-local pixels (pre-rotation). */
function computeBeadOutwardOffset(
  beadCenterX: number,
  beadCenterY: number,
  ringCenterX: number,
  ringCenterY: number,
  rotationDeg: number,
  slotExtent: number,
): { x: number; y: number; offset: number } {
  const dx = beadCenterX - ringCenterX;
  const dy = beadCenterY - ringCenterY;
  const len = Math.hypot(dx, dy) || 1;
  const offset = Math.max(8, slotExtent * 0.32);
  const wx = (dx / len) * offset;
  const wy = (dy / len) * offset;
  const rot = (-rotationDeg * Math.PI) / 180;
  return {
    x: wx * Math.cos(rot) - wy * Math.sin(rot),
    y: wx * Math.sin(rot) + wy * Math.cos(rot),
    offset,
  };
}

function beadShellTransform(
  rotationDeg: number,
  options?: { dragOverlay?: boolean },
): string {
  const parts: string[] = [];
  if (options?.dragOverlay) parts.push("scale(1.02)");
  parts.push(`rotate(${rotationDeg}deg)`);
  return parts.join(" ");
}

interface SortableBeadProps {
  bead: PlacedBead | null;
  position: number;
  x: number;
  y: number;
  rotationDeg: number;
  slotDim: BeadSlotDimensions;
  onSlotClick: (position: number) => void;
  onBeadRemove?: (position: number) => void;
  isDragActive: boolean;
  emptyGuideMode: EmptySlotGuideMode;
  showRemoveAlways?: boolean;
  isSelected?: boolean;
  libraryDragActive?: boolean;
  ringCenterX: number;
  ringCenterY: number;
}

function SortableBead({
  bead,
  position,
  x,
  y,
  rotationDeg,
  slotDim,
  onSlotClick,
  onBeadRemove,
  isDragActive,
  emptyGuideMode,
  showRemoveAlways = false,
  isSelected = false,
  libraryDragActive = false,
  ringCenterX,
  ringCenterY,
}: SortableBeadProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: `bead-${position}`,
    disabled: !bead || libraryDragActive,
  });

  const imgSrc = getBeadImageUrl(bead);
  const hasImage = !!imgSrc;
  const mm = bead ? placedBeadSizeMm(bead) : 0;
  const shell = hasImage
    ? getPlacedBeadShellStyle(slotDim, true)
    : getPlacedBeadShellStyle(slotDim, false);

  const isEmptySlot = !bead;
  const style: React.CSSProperties = {
    ...shell,
    left: x - slotDim.width / 2,
    top: y - slotDim.height / 2,
    opacity: isDragging ? 0.4 : bead ? 1 : emptyGuideMode === "prominent" ? 1 : 0.78,
    transition:
      isDragActive || libraryDragActive
        ? undefined
        : "left 0.35s ease-out, top 0.35s ease-out, opacity 0.15s, transform 0.15s",
    zIndex: isEmptySlot && libraryDragActive ? 35 : 20,
    pointerEvents: bead && libraryDragActive ? "none" : "auto",
    transformOrigin: "center center",
    transform: beadShellTransform(rotationDeg, { dragOverlay: isDragging }),
    boxShadow: isDragging
      ? "0 6px 18px rgba(0,0,0,0.16)"
      : shell.boxShadow,
  };

  const slotExtent = Math.max(slotDim.width, slotDim.height);
  const outward = computeBeadOutwardOffset(x, y, ringCenterX, ringCenterY, rotationDeg, slotExtent);
  const removeBtnSize = Math.max(18, Math.min(22, slotExtent * 0.4));

  const label = bead?.bead.name ?? "";
  const title = bead
    ? `${label} · ${bead.size.label} — ${BRACELET_COPY.dragToReorder}`
    : BRACELET_COPY.emptySlotHint;

  const handleEmptySlotKeyDown = (e: KeyboardEvent) => {
    if (bead || libraryDragActive) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSlotClick(position);
    }
  };

  return (
    <div
      ref={setNodeRef}
      data-strand-slot
      style={style}
      {...(bead && !libraryDragActive ? { ...attributes, ...listeners } : {})}
      role={isEmptySlot ? "button" : undefined}
      tabIndex={isEmptySlot && !libraryDragActive ? 0 : undefined}
      onClick={() => !bead && !libraryDragActive && onSlotClick(position)}
      onKeyDown={handleEmptySlotKeyDown}
      className={cn(
        "absolute group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        bead
          ? cn(
              "cursor-grab bg-transparent active:cursor-grabbing",
              "transition-[transform,box-shadow] duration-200 ease-out",
              "hover:scale-[1.03] hover:shadow-[0_4px_14px_rgba(0,0,0,0.14)]",
              isDragging && "cursor-grabbing",
              isSelected && "ring-2 ring-primary/60 ring-offset-1 ring-offset-background",
            )
          : "cursor-pointer hover:border-primary/50 hover:bg-muted/20",
      )}
      title={title}
      aria-label={isEmptySlot ? BRACELET_COPY.emptySlotHint : title}
    >
      {hasImage && bead ? (
        <img
          src={imgSrc}
          alt=""
          draggable={false}
          decoding="async"
          {...getStrandBeadRasterSize(slotDim)}
          className="pointer-events-none h-full w-full select-none transition-[filter] duration-200 ease-out group-hover:brightness-[1.03]"
          style={{
            ...getStrandBeadImageStyle(bead.bead),
            filter: getPlacedBeadImageFilter(),
          }}
        />
      ) : null}
      {bead && (
        <span className="pointer-events-none absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
          {bead.bead.beadTypeSlug === "charm" || bead.bead.beadTypeSlug === "spacer"
            ? label
            : `${mm} mm`}
        </span>
      )}
      {bead && onBeadRemove && !libraryDragActive ? (
        <button
          type="button"
          title={BRACELET_COPY.removeBead}
          aria-label={BRACELET_COPY.removeBead}
          className={cn(
            "pointer-events-auto absolute z-40 flex items-center justify-center rounded-full",
            "border border-border bg-background text-muted-foreground shadow-sm",
            "transition-opacity hover:bg-destructive hover:text-destructive-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isDragging
              ? "opacity-0"
              : showRemoveAlways
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100 focus:opacity-100",
          )}
          style={{
            left: `calc(50% + ${outward.x}px)`,
            top: `calc(50% + ${outward.y}px)`,
            width: removeBtnSize,
            height: removeBtnSize,
            transform: "translate(-50%, -50%)",
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onBeadRemove(position);
          }}
        >
          <X
            className="shrink-0"
            style={{ width: removeBtnSize * 0.42, height: removeBtnSize * 0.42 }}
            strokeWidth={2.5}
          />
        </button>
      ) : null}
    </div>
  );
}

const SortableCircularStrand = ({
  placedBeads,
  onBeadsReorder,
  onSlotClick,
  onBeadDrop,
  onBeadRemove,
  label,
  wristSize,
  guideSizeMm,
  selectedPosition = null,
  hoverDropTarget = null,
  onHoverDropTarget,
  libraryDragActive = false,
  libraryDragPreview = null,
  pathStartAngle = STRAND_PATH_START_ANGLE,
  wristSizeBounds,
  size = 320,
  layoutKey = 0,
}: SortableCircularStrandProps) => {
  const isMobile = useIsMobile();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragClientPos, setDragClientPos] = useState<{ x: number; y: number } | null>(null);
  const [isLibraryDragOver, setIsLibraryDragOver] = useState(false);
  const [reorderHintVisible, setReorderHintVisible] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragClientStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragRafRef = useRef<number | null>(null);
  const pendingDragPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastHoverKeyRef = useRef<string | null>(null);

  const publishHoverTarget = useCallback(
    (target: StrandDropTarget | null) => {
      const key = target ? dropTargetKey(target) : null;
      if (key === lastHoverKeyRef.current) return;
      lastHoverKeyRef.current = key;
      onHoverDropTarget?.(target);
    },
    [onHoverDropTarget],
  );

  const scheduleDragClientPos = useCallback((pos: { x: number; y: number }) => {
    pendingDragPosRef.current = pos;
    if (dragRafRef.current !== null) return;
    dragRafRef.current = requestAnimationFrame(() => {
      dragRafRef.current = null;
      const next = pendingDragPosRef.current;
      if (next) setDragClientPos(next);
    });
  }, []);

  useEffect(
    () => () => {
      if (dragRafRef.current !== null) cancelAnimationFrame(dragRafRef.current);
    },
    [],
  );

  const dismissReorderHint = useCallback(() => {
    setReorderHintVisible(false);
    try {
      localStorage.setItem(REORDER_HINT_STORAGE_KEY, "1");
    } catch {
      /* storage unavailable */
    }
  }, []);

  const canvasSize = size;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const normalized = useMemo(() => normalizeFromSlots(placedBeads), [placedBeads]);
  const compositionMm = strandCircumferenceMm(normalized, guideSizeMm);
  const placedCount = normalized.length;
  const isStrandEmpty = placedCount === 0;

  useEffect(() => {
    if (placedCount < 2) {
      setReorderHintVisible(false);
      return;
    }
    try {
      if (localStorage.getItem(REORDER_HINT_STORAGE_KEY)) return;
    } catch {
      return;
    }
    setReorderHintVisible(true);
    const timer = window.setTimeout(dismissReorderHint, REORDER_HINT_AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [placedCount, dismissReorderHint]);

  const {
    slotsWithPosition,
    scaleFactor,
    center,
    radius,
    layoutSectors,
    insertionAngles,
    effectiveCanvasSize,
  } = useMemo(() => {
    const center = canvasSize / 2;

    type StrandSlot = {
      index: number;
      angle: number;
      arcSpan: number;
      rotationDeg: number;
      x: number;
      y: number;
      placed: PlacedBead | null;
      beadSize: number;
      slotDim: BeadSlotDimensions;
      layoutDim: BeadSlotDimensions;
      emptyDim: BeadSlotDimensions;
      isInsertionSlot: boolean;
    };

    const buildLayout = (beadScaleBoost: number) => {
      const scaleFactor = (canvasSize / STRAND_LAYOUT_BASELINE_PX) * beadScaleBoost;
      const guideSlotDim = getGuideSlotDimensions(scaleFactor, guideSizeMm);

      let slotsWithPosition: StrandSlot[] = [];
      let maxExtent = Math.max(guideSlotDim.width, guideSlotDim.height);

      if (!isStrandEmpty) {
        const prelimDims = normalized.map((placed) => {
          const beadSize = placedBeadSizeMm(placed);
          return getBeadSlotDimensions(placed, beadSize, scaleFactor);
        });
        maxExtent = getMaxSlotExtent(prelimDims);
      }

      const bounds =
        wristSizeBounds.minCm > 0 && wristSizeBounds.maxCm > 0
          ? wristSizeBounds
          : { minCm: wristSize, maxCm: wristSize };
      const wristRadius = computeWristRingRadiusPx(center, wristSize, scaleFactor, maxExtent, bounds);
      const maxRadiusPx = computeMaxRingRadiusPx(center, scaleFactor, maxExtent);

      let radius = wristRadius;
      let layoutSectors: LayoutAngleSector[] = [];
      let insertionAngles: number[] = [];

      if (!isStrandEmpty) {
        const prelimDims = normalized.map((placed) => {
          const beadSize = placedBeadSizeMm(placed);
          return getBeadSlotDimensions(placed, beadSize, scaleFactor);
        });
        const beadLayoutArcsPx = prelimDims.map((dim) => beadLayoutArcPx(dim, scaleFactor));

        const resolved = computeResolvedRingRadiusPx({
          beadLayoutArcPx: beadLayoutArcsPx,
          wristRadiusPx: wristRadius,
          maxRadiusPx,
          scaleFactor,
        });

        radius = resolved.radiusPx;
        const ringCircumferencePx = 2 * Math.PI * radius;
        const elastic = computeElasticBeadLayout(
          resolved.beadArcPx,
          ringCircumferencePx,
          pathStartAngle,
          resolved.pairGapPx,
        );
        insertionAngles = elastic.insertionAngles;

        const pathLayout = computeStrandPathLayout({
          beads: normalized.map((_, i) => ({ index: i, beadMm: resolved.beadArcPx[i] })),
          layoutCircumferenceMm: ringCircumferencePx,
          centerX: center,
          centerY: center,
          radius,
          startAngle: pathStartAngle,
          minGapPx: resolved.pairGapPx,
          rotationOffsetByIndex: (index) =>
            beadTypeRotationOffsetDeg(normalized[index]?.bead.beadTypeSlug),
        });

        layoutSectors = pathLayout.map((path) => ({
          index: path.index,
          angle: path.angle,
          arcSpan: path.arcSpan,
        }));

        slotsWithPosition = normalized.map((placed, i) => {
          const beadSize = placedBeadSizeMm(placed);
          const slotDim = prelimDims[i]!;
          const path = pathLayout[i]!;
          return {
            index: i,
            angle: path.angle,
            arcSpan: path.arcSpan,
            rotationDeg: path.rotationDeg,
            x: path.x,
            y: path.y,
            placed,
            beadSize,
            slotDim,
            layoutDim: slotDim,
            emptyDim: slotDim,
            isInsertionSlot: false,
          };
        });
      }

      return { slotsWithPosition, scaleFactor, center, radius, layoutSectors, insertionAngles };
    };

    const base = buildLayout(1);
    const bbox = isStrandEmpty
      ? [
          {
            x: base.center,
            y: base.center,
            width: Math.max(1, base.radius * 2),
            height: Math.max(1, base.radius * 2),
          },
        ]
      : base.slotsWithPosition.map((slot) => {
          const extent = Math.hypot(slot.slotDim.width, slot.slotDim.height);
          return { x: slot.x, y: slot.y, width: extent, height: extent };
        });
    const fill = computeStrandBboxFillScale(
      bbox,
      canvasSize,
      STRAND_TARGET_BBOX_FILL,
      STRAND_MAX_LAYOUT_FILL,
    );

    const laidOut = fill > 1.01 ? buildLayout(fill) : base;

    const edgePad = STRAND_RING_EDGE_PADDING_PX * laidOut.scaleFactor + STRAND_CONTENT_PADDING_PX;
    const bounds = computeStrandContentBounds(
      laidOut.slotsWithPosition.map((slot) => ({
        x: slot.x,
        y: slot.y,
        width: slot.slotDim.width,
        height: slot.slotDim.height,
      })),
      laidOut.radius,
      laidOut.center,
    );
    const requiredCanvas = squareCanvasSizeForBounds(bounds, edgePad);
    const effectiveCanvasSize = Math.max(canvasSize, requiredCanvas);
    const targetCenter = effectiveCanvasSize / 2;
    const shifted = shiftStrandLayoutToCanvasCenter({
      ringCenter: laidOut.center,
      targetCenter,
      slots: laidOut.slotsWithPosition,
    });

    return {
      slotsWithPosition: shifted.slots,
      scaleFactor: laidOut.scaleFactor,
      center: shifted.ringCenter,
      radius: laidOut.radius,
      layoutSectors: laidOut.layoutSectors,
      insertionAngles: laidOut.insertionAngles,
      effectiveCanvasSize,
    };
  }, [normalized, canvasSize, guideSizeMm, isStrandEmpty, wristSize, wristSizeBounds]);

  const renderCanvasSize = effectiveCanvasSize;

  const parseSlotId = (id: string | number | undefined): number | null => {
    const m = String(id ?? "").match(/^bead-(\d+)$/);
    return m ? parseInt(m[1], 10) : null;
  };

  const parseLibraryPayload = useCallback((raw: string): LibraryDropPayload | null => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as LibraryDropPayload;
    } catch {
      return null;
    }
  }, []);

  const renderSlots = useMemo(
    () => slotsWithPosition.filter((slot) => slot.placed),
    [slotsWithPosition],
  );

  const pointerAngleFromClient = useCallback(
    (clientX: number, clientY: number): number | null => {
      if (!canvasRef.current) return null;
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = renderCanvasSize / rect.width;
      const scaleY = renderCanvasSize / rect.height;
      const localX = (clientX - rect.left) * scaleX;
      const localY = (clientY - rect.top) * scaleY;
      return pointerAngleOnCanvas(center, center, localX, localY);
    },
    [renderCanvasSize, center],
  );

  const resolveLibraryDropFromClient = useCallback(
    (clientX: number, clientY: number): StrandDropTarget => {
      const angle = pointerAngleFromClient(clientX, clientY);
      if (placedCount === 0) {
        return {
          mode: "insert",
          index: 0,
          anchorAngleRad: angle ?? pathStartAngle,
        };
      }
      if (angle === null) return { mode: "insert", index: 0 };
      return resolveDropTargetFromLayout(angle, layoutSectors, insertionAngles);
    },
    [placedCount, pointerAngleFromClient, layoutSectors, insertionAngles, pathStartAngle],
  );

  const resolveReorderTargetFromClient = useCallback(
    (clientX: number, clientY: number): StrandDropTarget => {
      if (placedCount === 0) return { mode: "insert", index: 0 };
      const angle = pointerAngleFromClient(clientX, clientY);
      if (angle === null) return { mode: "insert", index: 0 };
      return resolveDropTargetFromLayout(angle, layoutSectors, insertionAngles);
    },
    [placedCount, pointerAngleFromClient, layoutSectors, insertionAngles],
  );

  const isClientOverCanvas = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return false;
    return (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );
  }, []);

  useEffect(() => {
    if (!libraryDragActive) return;

    const onDocumentDragOver = (e: DragEvent) => {
      if (!isLibraryDragEvent(e) && !e.dataTransfer?.types.includes("application/json")) return;
      if (!isClientOverCanvas(e.clientX, e.clientY)) {
        publishHoverTarget(null);
        return;
      }
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      setIsLibraryDragOver(true);
      publishHoverTarget(resolveLibraryDropFromClient(e.clientX, e.clientY));
    };

    document.addEventListener("dragover", onDocumentDragOver);
    return () => document.removeEventListener("dragover", onDocumentDragOver);
  }, [
    libraryDragActive,
    isClientOverCanvas,
    resolveLibraryDropFromClient,
    publishHoverTarget,
  ]);

  const handleCanvasLibraryDragEnter = (e: React.DragEvent) => {
    if (!isLibraryDragEvent(e) && !e.dataTransfer.types.includes("application/json")) return;
    setIsLibraryDragOver(true);
  };

  const handleCanvasLibraryDragOver = (e: React.DragEvent) => {
    if (!isLibraryDragEvent(e) && !e.dataTransfer.types.includes("application/json")) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    publishHoverTarget(resolveLibraryDropFromClient(e.clientX, e.clientY));
  };

  const handleCanvasLibraryDragLeave = (e: React.DragEvent) => {
    const related = e.relatedTarget as Node | null;
    if (related && canvasRef.current?.contains(related)) return;
    setIsLibraryDragOver(false);
    publishHoverTarget(null);
  };

  const handleCanvasLibraryDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLibraryDragOver(false);
    publishHoverTarget(null);
    if (!onBeadDrop) return;
    const raw =
      e.dataTransfer.getData(BEAD_LIBRARY_DRAG_TYPE) ||
      e.dataTransfer.getData("application/json");
    const data = parseLibraryPayload(raw);
    if (!data?.bead) return;
    onBeadDrop(resolveLibraryDropFromClient(e.clientX, e.clientY), data);
  };

  const readClientPoint = (event: Event | null | undefined): { x: number; y: number } | null => {
    if (!event) return null;
    if ("clientX" in event && typeof event.clientX === "number") {
      return { x: event.clientX, y: event.clientY };
    }
    if ("touches" in event) {
      const touch = event.touches?.[0] ?? event.changedTouches?.[0];
      if (touch) return { x: touch.clientX, y: touch.clientY };
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    dismissReorderHint();
    setActiveId(event.active.id as string);
    const pointer = readClientPoint(event.activatorEvent);
    if (!pointer) {
      dragClientStartRef.current = null;
      setDragClientPos(null);
      return;
    }
    dragClientStartRef.current = pointer;
    setDragClientPos(pointer);
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const start = dragClientStartRef.current;
    if (!start) return;
    const pos = { x: start.x + event.delta.x, y: start.y + event.delta.y };
    scheduleDragClientPos(pos);
    const target = resolveReorderTargetFromClient(pos.x, pos.y);
    publishHoverTarget(
      target.mode === "insert" ? target : { mode: "replace", index: target.index },
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const from = parseSlotId(event.active.id);
    const start = dragClientStartRef.current;
    const toTarget = start
      ? resolveReorderTargetFromClient(start.x + event.delta.x, start.y + event.delta.y)
      : null;
    if (from !== null && toTarget) {
      const to =
        toTarget.mode === "replace"
          ? toTarget.index
          : toTarget.index > from
            ? toTarget.index - 1
            : toTarget.index;
      if (from !== to) {
        onBeadsReorder(from, to);
      }
    }
    setActiveId(null);
    dragClientStartRef.current = null;
    setDragClientPos(null);
    lastHoverKeyRef.current = null;
    publishHoverTarget(null);
  };

  const activeBead = activeId
    ? normalized.find((b) => `bead-${b.position}` === activeId)
    : null;

  const activeSlotDim = activeBead
    ? getBeadSlotDimensions(activeBead, placedBeadSizeMm(activeBead), scaleFactor)
    : null;

  const activeRotationDeg = activeBead
    ? (renderSlots.find((s) => s.index === activeBead.position)?.rotationDeg ?? 0)
    : 0;

  const externalDrag = libraryDragActive || isLibraryDragOver;
  const dropZoneInteractive = externalDrag || activeId === null;
  const libraryDropHover = externalDrag && hoverDropTarget ? hoverDropTarget : null;
  const reorderHover =
    !externalDrag && activeId !== null && hoverDropTarget ? hoverDropTarget : null;

  const clientToCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: renderCanvasSize / 2, y: renderCanvasSize / 2 };
      const scaleX = renderCanvasSize / rect.width;
      const scaleY = renderCanvasSize / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    },
    [renderCanvasSize],
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        dragClientStartRef.current = null;
        setDragClientPos(null);
        lastHoverKeyRef.current = null;
        publishHoverTarget(null);
      }}
    >
      <div className="flex flex-col items-center gap-1 sm:gap-1.5">
        {label ? (
          <span className="text-xs font-body uppercase tracking-widest text-muted-foreground">
            {label}
          </span>
        ) : null}

        <div
          ref={canvasRef}
          className={cn(
            "relative bg-white dark:bg-card",
            activeId && !externalDrag && "cursor-grabbing",
          )}
          style={{ width: renderCanvasSize, height: renderCanvasSize }}
          key={layoutKey}
          data-strand-canvas
          data-strand-content-size={renderCanvasSize}
        >
          {activeBead && activeSlotDim && dragClientPos ? (() => {
            const { x: localX, y: localY } = clientToCanvas(dragClientPos.x, dragClientPos.y);
            const dragImgUrl = getBeadImageUrl(activeBead);
            const hasImage = !!dragImgUrl;
            return (
              <div
                style={{
                  position: "absolute",
                  left: localX - activeSlotDim.width / 2,
                  top: localY - activeSlotDim.height / 2,
                  zIndex: 30,
                  pointerEvents: "none",
                  // When we have a bead image, ensure the wrapper does not paint any background.
                  ...getPlacedBeadShellStyle(activeSlotDim, hasImage),
                  opacity: 0.92,
                  boxShadow: "0 4px 14px rgba(0,0,0,0.16)",
                  transformOrigin: "center center",
                  transform: beadShellTransform(activeRotationDeg, { dragOverlay: true }),
                }}
              >
                {hasImage ? (
                  <img
                    src={dragImgUrl!}
                    alt=""
                    draggable={false}
                    decoding="async"
                    {...getStrandBeadRasterSize(activeSlotDim)}
                    className="h-full w-full"
                    style={{
                      ...getStrandBeadImageStyle(activeBead.bead),
                      filter: getPlacedBeadImageFilter(),
                    }}
                  />
                ) : null}
              </div>
            );
          })() : null}
          <svg
            className="pointer-events-none absolute inset-0 z-[5]"
            width={renderCanvasSize}
            height={renderCanvasSize}
            style={{ transition: activeId || externalDrag ? undefined : "opacity 0.25s ease-out" }}
          >
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={externalDrag ? STRAND_CORD.strokeDrag : STRAND_CORD.stroke}
              strokeWidth={Math.max(2, STRAND_CORD.widthFactor * scaleFactor)}
              opacity={
                externalDrag ? 1 : placedCount > 0 ? STRAND_CORD.opacityComplete : STRAND_CORD.opacity
              }
              style={{ transition: activeId || externalDrag ? undefined : "r 0.35s ease-out" }}
            />
          </svg>

          <div
            data-strand-drop-zone
            className={`absolute inset-0 ${externalDrag ? "z-[40]" : "z-[10]"} ${dropZoneInteractive ? "" : "pointer-events-none"}`}
            onDragEnter={handleCanvasLibraryDragEnter}
            onDragOver={handleCanvasLibraryDragOver}
            onDragLeave={handleCanvasLibraryDragLeave}
            onDrop={handleCanvasLibraryDrop}
            onClick={() => {
              if (!isStrandEmpty || externalDrag || activeId) return;
              onSlotClick(0);
            }}
          />

          <SortableContext items={renderSlots.map((s) => `bead-${s.index}`)}>
            {renderSlots.map((slot) => (
              <SortableBead
                key={slot.index}
                bead={slot.placed}
                position={slot.index}
                x={slot.x}
                y={slot.y}
                rotationDeg={slot.rotationDeg}
                slotDim={slot.slotDim}
                onSlotClick={onSlotClick}
                onBeadRemove={onBeadRemove}
                isDragActive={activeId !== null}
                emptyGuideMode="none"
                showRemoveAlways={isMobile}
                isSelected={selectedPosition === slot.index}
                libraryDragActive={externalDrag}
                ringCenterX={center}
                ringCenterY={center}
              />
            ))}
          </SortableContext>

        </div>

        <div
          className="max-w-full px-1 text-center font-body text-[10px] leading-snug text-muted-foreground sm:text-[11px]"
          style={{ width: renderCanvasSize, maxWidth: "100%" }}
        >
          {reorderHover ? (
            <p className="text-muted-foreground">{BRACELET_COPY.dropReorderHint}</p>
          ) : libraryDropHover ? (
            <p className="text-muted-foreground">
              {libraryDropHover.mode === "replace"
                ? BRACELET_COPY.dropReplaceHint
                : BRACELET_COPY.dropInsertHint}
            </p>
          ) : reorderHintVisible && placedCount >= 2 ? (
            <div className="inline-flex max-w-full items-center justify-center gap-1.5 rounded-full border border-border/50 bg-muted/20 px-3 py-1">
              <p className="text-muted-foreground">{BRACELET_COPY.strandReorderHint}</p>
              <button
                type="button"
                onClick={dismissReorderHint}
                className="shrink-0 rounded-full p-0.5 text-muted-foreground/80 transition-colors hover:bg-muted/50 hover:text-foreground"
                aria-label={BRACELET_COPY.dismissHint}
              >
                <X className="h-3 w-3" strokeWidth={2} />
              </button>
            </div>
          ) : isStrandEmpty ? (
            <>
              <p className="font-medium uppercase tracking-widest text-muted-foreground/90">
                {BRACELET_COPY.strandGuideTitle}
              </p>
              <p className="mt-0.5 font-display text-xs font-semibold text-foreground sm:text-sm">
                {BRACELET_COPY.strandEmptyGuide}
              </p>
              <p className="mt-1 text-muted-foreground">{BRACELET_COPY.strandEmptyReorderNote}</p>
              <p className="mt-1">{BRACELET_COPY.strandHint}</p>
            </>
          ) : (
            <p className="font-display text-xs font-semibold text-foreground sm:text-sm">
              {placedCount} {BRACELET_COPY.piecesOnStrand} · {BRACELET_COPY.strandLength(compositionMm)}
            </p>
          )}
        </div>
      </div>
    </DndContext>
  );
};

export default SortableCircularStrand;
