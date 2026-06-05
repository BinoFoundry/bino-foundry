import { useState, useRef, useCallback, useMemo, type KeyboardEvent } from "react";
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
import { BRACELET_COPY } from "@/features/bracelet/copy";
import { BEAD_LIBRARY_DRAG_TYPE, isLibraryDragEvent } from "@/features/bracelet/interaction";
import {
  beadIndexFromPointerAngle,
  beadTypeRotationOffsetDeg,
  computeStrandBboxFillScale,
  computeStrandPathLayout,
  pointerAngleOnCanvas,
} from "@/features/bracelet/strand-layout";
import {
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

interface SortableCircularStrandProps {
  placedBeads: PlacedBead[];
  onBeadsReorder: (fromPosition: number, toPosition: number) => void;
  onSlotClick: (position: number) => void;
  onBeadDrop?: (position: number, data: LibraryDropPayload) => void;
  onBeadRemove?: (position: number) => void;
  label?: string;
  wristSize: number;
  guideSizeMm: number;
  selectedPosition?: number | null;
  hoverPosition?: number | null;
  onHoverPosition?: (position: number | null) => void;
  libraryDragActive?: boolean;
  panMode?: boolean;
  size?: number;
  layoutKey?: string | number;
}

function beadShellTransform(
  rotationDeg: number,
  options?: { dropActive?: boolean; dragOverlay?: boolean },
): string {
  const parts: string[] = [];
  if (options?.dragOverlay) parts.push("scale(1.06)");
  else if (options?.dropActive) parts.push("scale(1.08)");
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
  isDropTarget?: boolean;
  libraryDragActive?: boolean;
  onLibraryDragOver?: (e: React.DragEvent, position: number) => void;
  onLibraryDrop?: (e: React.DragEvent, position: number) => void;
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
  isDropTarget = false,
  libraryDragActive = false,
  onLibraryDragOver,
  onLibraryDrop,
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
  const dropActive = libraryDragActive && isDropTarget;

  const style: React.CSSProperties = {
    ...shell,
    left: x - slotDim.width / 2,
    top: y - slotDim.height / 2,
    opacity: isDragging ? 0.35 : bead ? 1 : emptyGuideMode === "prominent" ? 1 : 0.78,
    transition: isDragActive || libraryDragActive ? undefined : "opacity 0.15s, transform 0.15s, box-shadow 0.15s",
    zIndex: dropActive ? 40 : isEmptySlot && libraryDragActive ? 35 : 20,
    pointerEvents: bead && libraryDragActive ? "none" : "auto",
    transformOrigin: "center center",
    transform: beadShellTransform(rotationDeg, { dropActive }),
    boxShadow: dropActive
      ? "0 0 0 3px hsl(var(--primary) / 0.65), 0 4px 14px hsl(var(--primary) / 0.25)"
      : shell.boxShadow,
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
      onDragEnter={(e) => isEmptySlot && onLibraryDragOver?.(e, position)}
      onDragOver={(e) => onLibraryDragOver?.(e, position)}
      onDragLeave={(e) => {
        if (!isEmptySlot) return;
        const related = e.relatedTarget as Node | null;
        if (related && e.currentTarget.contains(related)) return;
      }}
      onDrop={(e) => onLibraryDrop?.(e, position)}
      className={`absolute group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
        bead
          ? `cursor-grab bg-transparent active:cursor-grabbing hover:scale-[1.04] active:scale-[0.98] ${isSelected ? "ring-2 ring-primary/60 ring-offset-1 ring-offset-background" : ""}`
          : `cursor-pointer hover:border-primary/50 hover:bg-muted/20 ${dropActive ? "border-primary bg-primary/10" : ""}`
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
        <button
          type="button"
          title={BRACELET_COPY.removeBead}
          aria-label={BRACELET_COPY.removeBead}
          className={`absolute -right-1 -top-1 z-30 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-opacity hover:bg-destructive hover:text-destructive-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
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
  hoverPosition = null,
  onHoverPosition,
  libraryDragActive = false,
  panMode = false,
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
  const showStrandGuide = true;

  const { slotsWithPosition, scaleFactor, center, radius } = useMemo(() => {
    const center = canvasSize / 2;

    const buildLayout = (layoutFill: number) => {
      const scaleFactor = (canvasSize / STRAND_LAYOUT_BASELINE_PX) * layoutFill;
      const strandPadding = STRAND_RING_EDGE_PADDING_PX * scaleFactor;
      const guideSlotDim = getGuideSlotDimensions(scaleFactor, guideSizeMm);

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

      let slotsWithPosition: StrandSlot[] = [];
      let radius = center - strandPadding - Math.max(guideSlotDim.width, guideSlotDim.height) / 2;

      if (!isStrandEmpty) {
        const prelimDims = normalized.map((placed) => {
          const beadSize = placedBeadSizeMm(placed);
          return getBeadSlotDimensions(placed, beadSize, scaleFactor);
        });
        const maxExtent = getMaxSlotExtent(prelimDims);
        radius = center - maxExtent / 2 - strandPadding;

        const pathLayout = computeStrandPathLayout({
          beads: normalized.map((_, i) => ({ index: i })),
          centerX: center,
          centerY: center,
          radius,
          rotationOffsetByIndex: (index) =>
            beadTypeRotationOffsetDeg(normalized[index]?.bead.beadTypeSlug),
        });

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

      return { slotsWithPosition, scaleFactor, center, radius };
    };

    const base = buildLayout(1);
    const bbox = isStrandEmpty
      ? [
          {
            x: base.center,
            y: base.center,
            width: Math.max(1, base.radius * 0.2),
            height: Math.max(1, base.radius * 0.2),
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
    return {
      slotsWithPosition: laidOut.slotsWithPosition,
      scaleFactor: laidOut.scaleFactor,
      center: laidOut.center,
      radius: laidOut.radius,
    };
  }, [
    normalized,
    canvasSize,
    guideSizeMm,
    showStrandGuide,
    isStrandEmpty,
  ]);

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

  const handleLibraryDragOverSlot = useCallback(
    (e: React.DragEvent, position: number) => {
      if (!isLibraryDragEvent(e) && !e.dataTransfer.types.includes("application/json")) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "copy";
      setIsLibraryDragOver(true);
      onHoverPosition?.(position);
    },
    [onHoverPosition],
  );

  const handleLibraryDropSlot = useCallback(
    (e: React.DragEvent, position: number) => {
      if (!onBeadDrop) return;
      e.preventDefault();
      e.stopPropagation();
      setIsLibraryDragOver(false);
      onHoverPosition?.(null);
      const raw =
        e.dataTransfer.getData(BEAD_LIBRARY_DRAG_TYPE) ||
        e.dataTransfer.getData("application/json");
      const data = parseLibraryPayload(raw);
      if (data?.bead) onBeadDrop(position, data);
    },
    [onBeadDrop, onHoverPosition, parseLibraryPayload],
  );

  const placedSlots = useMemo(
    () => slotsWithPosition.filter((slot) => slot.placed),
    [slotsWithPosition],
  );

  const resolveTargetFromClient = useCallback(
    (clientX: number, clientY: number): number => {
      if (!canvasRef.current || placedCount === 0) return 0;

      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = canvasSize / rect.width;
      const scaleY = canvasSize / rect.height;
      const localX = (clientX - rect.left) * scaleX;
      const localY = (clientY - rect.top) * scaleY;
      const angle = pointerAngleOnCanvas(center, center, localX, localY);
      return beadIndexFromPointerAngle(angle, placedCount);
    },
    [canvasSize, center, placedCount],
  );

  const handleCanvasLibraryDragEnter = (e: React.DragEvent) => {
    if (!isLibraryDragEvent(e) && !e.dataTransfer.types.includes("application/json")) return;
    setIsLibraryDragOver(true);
  };

  const handleCanvasLibraryDragOver = (e: React.DragEvent) => {
    if (!isLibraryDragEvent(e) && !e.dataTransfer.types.includes("application/json")) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    const slotIndex = resolveTargetFromClient(e.clientX, e.clientY);
    onHoverPosition?.(slotIndex);
  };

  const handleCanvasLibraryDragLeave = (e: React.DragEvent) => {
    const related = e.relatedTarget as Node | null;
    if (related && canvasRef.current?.contains(related)) return;
    setIsLibraryDragOver(false);
    onHoverPosition?.(null);
  };

  const handleCanvasLibraryDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLibraryDragOver(false);
    onHoverPosition?.(null);
    if (!onBeadDrop) return;
    const raw =
      e.dataTransfer.getData(BEAD_LIBRARY_DRAG_TYPE) ||
      e.dataTransfer.getData("application/json");
    const data = parseLibraryPayload(raw);
    if (!data?.bead) return;
    const slotIndex = resolveTargetFromClient(e.clientX, e.clientY);
    onBeadDrop(slotIndex, data);
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
    onHoverPosition?.(resolveTargetFromClient(pos.x, pos.y));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const from = parseSlotId(event.active.id);
    const start = dragClientStartRef.current;
    const to = start
      ? resolveTargetFromClient(start.x + event.delta.x, start.y + event.delta.y)
      : parseSlotId(event.over?.id);
    if (from !== null && to !== null && from !== to) {
      onBeadsReorder(from, to);
    }
    setActiveId(null);
    dragClientStartRef.current = null;
    setDragClientPos(null);
    onHoverPosition?.(null);
  };

  const activeBead = activeId
    ? normalized.find((b) => `bead-${b.position}` === activeId)
    : null;

  const activeSlotDim = activeBead
    ? getBeadSlotDimensions(activeBead, placedBeadSizeMm(activeBead), scaleFactor)
    : null;

  const activeRotationDeg = activeBead
    ? (placedSlots.find((s) => s.index === activeBead.position)?.rotationDeg ?? 0)
    : 0;

  const externalDrag = libraryDragActive || isLibraryDragOver;
  const dropZoneInteractive = externalDrag || (!panMode && activeId === null);
  const dropHighlight =
    hoverPosition !== null && hoverPosition !== undefined ? hoverPosition : null;
  const showDropRing = dropHighlight !== null && (externalDrag || activeId !== null);

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
        onHoverPosition?.(null);
      }}
    >
      <div className="flex flex-col items-center gap-2 sm:gap-3">
        {label ? (
          <span className="text-xs font-body uppercase tracking-widest text-muted-foreground">
            {label}
          </span>
        ) : null}

        <div
          ref={canvasRef}
          className={`relative ${panMode && !externalDrag && !activeId ? "cursor-grab" : ""}`}
          style={{ width: canvasSize, height: canvasSize }}
          key={layoutKey}
          data-strand-canvas
        >
          {activeBead && activeSlotDim && dragClientPos ? (() => {
            const rect = canvasRef.current?.getBoundingClientRect();
            const localX = rect ? dragClientPos.x - rect.left : canvasSize / 2;
            const localY = rect ? dragClientPos.y - rect.top : canvasSize / 2;
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
                  opacity: 0.96,
                  boxShadow: "0 8px 22px rgba(0,0,0,0.24)",
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
          <svg className="pointer-events-none absolute inset-0 z-[5]" width={canvasSize} height={canvasSize}>
            {showStrandGuide ? (
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill={`hsl(var(--muted) / ${isStrandEmpty ? 0.35 : 0.26})`}
                stroke="none"
              />
            ) : null}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={externalDrag ? STRAND_CORD.strokeDrag : STRAND_CORD.stroke}
              strokeWidth={Math.max(2.5, STRAND_CORD.widthFactor * scaleFactor)}
              opacity={
                externalDrag ? 1 : placedCount > 0 ? STRAND_CORD.opacityComplete : STRAND_CORD.opacity
              }
            />
            {showDropRing
              ? (() => {
                  const slot = placedSlots.find((s) => s.index === dropHighlight);
                  const cx = slot?.x ?? center + radius * Math.cos(-Math.PI / 2);
                  const cy = slot?.y ?? center + radius * Math.sin(-Math.PI / 2);
                  const r = slot
                    ? Math.max(slot.slotDim.width, slot.slotDim.height) * 0.58
                    : Math.max(12, radius * 0.08);
                  return (
                    <g key="drop-ring">
                      <circle
                        cx={cx}
                        cy={cy}
                        r={r}
                        fill="hsl(var(--primary) / 0.14)"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        strokeDasharray="5 4"
                      />
                    </g>
                  );
                })()
              : null}
          </svg>

          <div
            data-strand-drop-zone
            className={`absolute inset-0 ${externalDrag ? "z-[30]" : "z-[10]"} ${dropZoneInteractive ? "" : "pointer-events-none"}`}
            onDragEnter={handleCanvasLibraryDragEnter}
            onDragOver={handleCanvasLibraryDragOver}
            onDragLeave={handleCanvasLibraryDragLeave}
            onDrop={handleCanvasLibraryDrop}
            onClick={() => {
              if (!isStrandEmpty || externalDrag || activeId || panMode) return;
              onSlotClick(0);
            }}
          />

          <SortableContext items={placedSlots.map((s) => `bead-${s.index}`)}>
            {placedSlots.map((slot) => (
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
                isDropTarget={dropHighlight === slot.index}
                libraryDragActive={externalDrag}
                onLibraryDragOver={handleLibraryDragOverSlot}
                onLibraryDrop={handleLibraryDropSlot}
              />
            ))}
          </SortableContext>

        </div>

        <div
          className="max-w-full px-1 text-center font-body text-[10px] leading-snug text-muted-foreground sm:text-[11px]"
          style={{ width: canvasSize }}
        >
          {isStrandEmpty ? (
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
