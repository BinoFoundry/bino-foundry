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
  squareCanvasSizeForBounds,
  STRAND_CONTENT_PADDING_PX,
  STRAND_LAYOUT_BASELINE_PX,
  STRAND_MAX_LAYOUT_FILL,
  STRAND_RING_EDGE_PADDING_PX,
  STRAND_TARGET_BBOX_FILL,
} from "@/features/bracelet/strand-viewport";
import type { BeadLibraryEntry } from "@/types/beads";

type EmptySlotGuideMode = "prominent" | "moderate" | "none";

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
    transform: beadShellTransform(rotationDeg),
    boxShadow: shell.boxShadow,
  };

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
      className={`absolute group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
        bead
          ? `cursor-grab bg-transparent active:cursor-grabbing hover:scale-[1.04] active:scale-[0.98] ${
              isSelected ? "ring-2 ring-primary/60 ring-offset-1 ring-offset-background" : ""
            }`
          : "cursor-pointer hover:border-primary/50 hover:bg-muted/20"
      }`}
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
          className="pointer-events-none h-full w-full select-none"
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
        <div
          className="pointer-events-none absolute inset-0 z-30"
          style={{ transform: `rotate(${-rotationDeg}deg)` }}
        >
          <button
            type="button"
            title={BRACELET_COPY.removeBead}
            aria-label={BRACELET_COPY.removeBead}
            className={`pointer-events-auto absolute left-1/2 top-0 z-30 flex h-6 w-6 -translate-x-1/2 -translate-y-[110%] items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-opacity hover:bg-destructive hover:text-destructive-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              showRemoveAlways ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100"
            }`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onBeadRemove(position);
            }}
          >
            <X className="h-3 w-3" strokeWidth={2.5} />
          </button>
        </div>
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
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragClientStartRef = useRef<{ x: number; y: number } | null>(null);

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
    const bboxCx = (bounds.minX + bounds.maxX) / 2;
    const bboxCy = (bounds.minY + bounds.maxY) / 2;
    const shiftX = targetCenter - bboxCx;
    const shiftY = targetCenter - bboxCy;

    const slotsWithPosition = laidOut.slotsWithPosition.map((slot) => ({
      ...slot,
      x: slot.x + shiftX,
      y: slot.y + shiftY,
    }));

    return {
      slotsWithPosition,
      scaleFactor: laidOut.scaleFactor,
      center: targetCenter,
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
        onHoverDropTarget?.(null);
        return;
      }
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      setIsLibraryDragOver(true);
      onHoverDropTarget?.(resolveLibraryDropFromClient(e.clientX, e.clientY));
    };

    document.addEventListener("dragover", onDocumentDragOver);
    return () => document.removeEventListener("dragover", onDocumentDragOver);
  }, [
    libraryDragActive,
    isClientOverCanvas,
    resolveLibraryDropFromClient,
    onHoverDropTarget,
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
    onHoverDropTarget?.(resolveLibraryInsertFromClient(e.clientX, e.clientY));
  };

  const handleCanvasLibraryDragLeave = (e: React.DragEvent) => {
    const related = e.relatedTarget as Node | null;
    if (related && canvasRef.current?.contains(related)) return;
    setIsLibraryDragOver(false);
    onHoverDropTarget?.(null);
  };

  const handleCanvasLibraryDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLibraryDragOver(false);
    onHoverDropTarget?.(null);
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
    setDragClientPos(pos);
    const target = resolveReorderTargetFromClient(pos.x, pos.y);
    onHoverDropTarget?.(
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
    onHoverDropTarget?.(null);
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
  const activeDropHover = libraryDropHover ?? reorderHover;
  const showDropIndicator = externalDrag && activeDropHover !== null;

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
        onHoverDropTarget?.(null);
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
          className="relative"
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
                  zIndex: 60,
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
            style={{ transition: "opacity 0.25s ease-out" }}
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
              style={{ transition: "r 0.35s ease-out" }}
            />
            {showDropIndicator && activeDropHover
              ? (() => {
                  const isInsert = activeDropHover.mode === "insert";
                  let cx: number;
                  let cy: number;
                  if (isInsert) {
                    const angle =
                      (placedCount === 0 && activeDropHover.anchorAngleRad !== undefined
                        ? activeDropHover.anchorAngleRad
                        : insertionAngles[activeDropHover.index]) ??
                      insertionAngles[0] ??
                      pathStartAngle;
                    cx = center + radius * Math.cos(angle);
                    cy = center + radius * Math.sin(angle);
                  } else {
                    const slot = renderSlots.find((s) => s.index === activeDropHover.index);
                    cx = slot?.x ?? center;
                    cy = slot?.y ?? center;
                  }
                  const dotR = Math.max(3, scaleFactor * 0.95);
                  return (
                    <circle
                      key="drop-indicator"
                      cx={cx}
                      cy={cy}
                      r={dotR}
                      fill={
                        isInsert
                          ? "hsl(var(--muted-foreground) / 0.5)"
                          : "hsl(var(--muted-foreground) / 0.65)"
                      }
                      stroke="hsl(var(--background) / 0.9)"
                      strokeWidth={1.25}
                    />
                  );
                })()
              : null}
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
          ) : isStrandEmpty ? (
            <>
              <p className="font-medium uppercase tracking-widest text-muted-foreground/90">
                {BRACELET_COPY.strandGuideTitle}
              </p>
              <p className="mt-0.5 font-display text-xs font-semibold text-foreground sm:text-sm">
                {BRACELET_COPY.strandEmptyGuide}
              </p>
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
