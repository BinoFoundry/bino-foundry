import { useState, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Plus, X } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { type PlacedBead, type BeadSize } from "@/lib/luxe-data";
import {
  getBeadImageUrl,
  getBeadSlotDimensions,
  buildStrandLoopPath,
  getGuideEmptySlotShellStyle,
  getGuideSlotDimensions,
  getPartialEmptySlotShellStyle,
  getMaxSlotExtent,
  getPlacedBeadImageFilter,
  getPlacedBeadShellStyle,
  getStrandBeadImageStyle,
  getStrandBeadRasterSize,
  STRAND_CORD,
  type BeadSlotDimensions,
} from "@/render/bead-crop";
import { BRACELET_COPY } from "@/features/bracelet/copy";

type EmptySlotGuideMode = "prominent" | "moderate" | "none";

interface SortableCircularStrandProps {
  beadCount: number;
  placedBeads: PlacedBead[];
  onBeadsReorder: (beads: PlacedBead[]) => void;
  onSlotClick: (position: number, beadSize: BeadSize) => void;
  onBeadDrop?: (position: number, data: { bead?: PlacedBead["bead"] }) => void;
  onBeadRemove?: (position: number) => void;
  label?: string;
  wristSize: number;
  defaultBeadSizeMm: number;
  size?: number;
  layoutKey?: string | number;
}

interface SortableBeadProps {
  bead: PlacedBead | null;
  position: number;
  x: number;
  y: number;
  slotDim: BeadSlotDimensions;
  onSlotClick: (position: number) => void;
  onBeadRemove?: (position: number) => void;
  isDragActive: boolean;
  emptyGuideMode: EmptySlotGuideMode;
  showRemoveAlways?: boolean;
}

function SortableBead({
  bead,
  position,
  x,
  y,
  slotDim,
  onSlotClick,
  onBeadRemove,
  isDragActive,
  emptyGuideMode,
  showRemoveAlways = false,
}: SortableBeadProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: `bead-${position}`,
  });

  const imgSrc = getBeadImageUrl(bead);
  const hasImage = !!imgSrc;
  const shell = hasImage
    ? getPlacedBeadShellStyle(slotDim, true)
    : bead
      ? getPlacedBeadShellStyle(slotDim, false)
      : emptyGuideMode === "prominent"
        ? getGuideEmptySlotShellStyle(slotDim)
        : getPartialEmptySlotShellStyle(slotDim);

  const style: React.CSSProperties = {
    ...shell,
    left: x - slotDim.width / 2,
    top: y - slotDim.height / 2,
    opacity: isDragging ? 0 : bead ? 1 : emptyGuideMode === "prominent" ? 1 : 0.78,
    transition: isDragActive ? undefined : "opacity 0.15s, transform 0.15s",
    zIndex: 20,
  };

  const label = bead?.bead.name ?? "";
  const title = bead
    ? `${label} (${bead.beadSize}mm) — Drag to reorder · ${BRACELET_COPY.removeBead}`
    : `Empty slot ${position + 1} — Click to place`;

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(bead ? listeners : {})}
      onClick={() => !bead && onSlotClick(position)}
      className={`absolute group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
        bead
          ? "cursor-grab bg-transparent active:cursor-grabbing hover:scale-[1.04] active:scale-[0.98]"
          : "cursor-pointer hover:border-primary/50 hover:bg-muted/20"
      }`}
      title={title}
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
      ) : !bead && emptyGuideMode !== "none" ? (
        <span
          className={`flex h-full w-full items-center justify-center ${
            emptyGuideMode === "prominent" ? "text-primary/45" : "text-muted-foreground/50"
          }`}
        >
          <Plus
            className={
              emptyGuideMode === "prominent"
                ? "h-[40%] w-[40%] min-h-3 min-w-3"
                : "h-[32%] w-[32%] min-h-2.5 min-w-2.5"
            }
            strokeWidth={2}
          />
        </span>
      ) : null}
      {bead && (
        <span className="pointer-events-none absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
          {bead.bead.beadTypeSlug === "charm" || bead.bead.beadTypeSlug === "spacer"
            ? label
            : `${bead.beadSize}mm`}
        </span>
      )}
      {bead && onBeadRemove ? (
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
    </button>
  );
}

const SortableCircularStrand = ({
  beadCount,
  placedBeads,
  onBeadsReorder,
  onSlotClick,
  onBeadDrop,
  onBeadRemove,
  label,
  wristSize,
  defaultBeadSizeMm,
  size = 320,
  layoutKey = 0,
}: SortableCircularStrandProps) => {
  const isMobile = useIsMobile();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const canvasSize = size;
  const center = canvasSize / 2;
  const scaleFactor = canvasSize / 320;
  const strandPadding = 8 * scaleFactor;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const placedCount = placedBeads.length;
  const isStrandEmpty = placedCount === 0;
  const isStrandComplete = placedCount >= beadCount;
  const showStrandGuide = !isStrandComplete;
  const remainingSlots = beadCount - placedCount;
  const guideSlotDim = getGuideSlotDimensions(scaleFactor, defaultBeadSizeMm);

  const slots = Array.from({ length: beadCount }, (_, i) => {
    const angle = (2 * Math.PI * i) / beadCount - Math.PI / 2;
    const placed = placedBeads.find((b) => b.position === i) ?? null;
    const beadSize = placed?.beadSize ?? defaultBeadSizeMm;
    const slotDim = getBeadSlotDimensions(placed, beadSize, scaleFactor);
    const layoutDim = showStrandGuide && !placed ? guideSlotDim : slotDim;
    return { index: i, angle, placed, beadSize, slotDim, layoutDim };
  });

  const maxExtent = getMaxSlotExtent(slots.map((s) => s.layoutDim));
  const radius = center - maxExtent / 2 - strandPadding;

  const slotsWithPosition = slots.map((slot) => {
    const x = center + radius * Math.cos(slot.angle);
    const y = center + radius * Math.sin(slot.angle);
    const emptyDim = showStrandGuide && !slot.placed ? slot.layoutDim : slot.slotDim;
    return { ...slot, x, y, emptyDim };
  });

  const strandLoopPath = buildStrandLoopPath(slotsWithPosition);
  const guideRingOpacity = isStrandEmpty ? 0.65 : 0.58;
  const guideFillOpacity = isStrandEmpty ? 0.35 : 0.26;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const draggedBead = placedBeads.find((b) => `bead-${b.position}` === active.id);
      const targetBead = placedBeads.find((b) => `bead-${b.position}` === over.id);

      if (draggedBead && targetBead) {
        const sorted = [...placedBeads].sort((a, b) => a.position - b.position);
        const sortedPositions = sorted.map((b) => b.position);
        const oldIndex = sorted.findIndex((b) => b.position === draggedBead.position);
        const newIndex = sorted.findIndex((b) => b.position === targetBead.position);
        const reordered = arrayMove(sorted, oldIndex, newIndex);
        const updatedBeads = reordered.map((bead, idx) => ({
          ...bead,
          position: sortedPositions[idx],
        }));
        onBeadsReorder(updatedBeads);
      } else if (draggedBead && !targetBead) {
        const match = String(over.id).match(/^bead-(\d+)$/);
        if (match) {
          const targetPosition = parseInt(match[1], 10);
          const updatedBeads = placedBeads.map((b) =>
            b.position === draggedBead.position ? { ...b, position: targetPosition } : b,
          );
          onBeadsReorder(updatedBeads);
        }
      }
    }
    setActiveId(null);
  };

  const findNearestSlot = (clientX: number, clientY: number): number => {
    if (!canvasRef.current) return 0;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasSize / rect.width;
    const scaleY = canvasSize / rect.height;
    const localX = (clientX - rect.left) * scaleX;
    const localY = (clientY - rect.top) * scaleY;
    let nearestIndex = 0;
    let minDist = Infinity;
    slotsWithPosition.forEach((slot) => {
      const dist = Math.hypot(slot.x - localX, slot.y - localY);
      if (dist < minDist) {
        minDist = dist;
        nearestIndex = slot.index;
      }
    });
    return nearestIndex;
  };

  const handleDropZoneDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("application/json")) {
      e.dataTransfer.dropEffect = "copy";
      setIsDragOver(true);
    }
  };

  const handleDropZoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!onBeadDrop) return;
    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as { bead?: PlacedBead["bead"] };
      const slotIndex = findNearestSlot(e.clientX, e.clientY);
      onBeadDrop(slotIndex, data);
    } catch (err) {
      console.error("Failed to parse dropped bead data:", err);
    }
  };

  const activeBead = activeId
    ? placedBeads.find((b) => `bead-${b.position}` === activeId)
    : null;

  const activeSlotDim = activeBead
    ? getBeadSlotDimensions(activeBead, activeBead.beadSize, scaleFactor)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col items-center gap-2 sm:gap-3">
        {label && (
          <span className="text-xs font-body uppercase tracking-widest text-muted-foreground">
            {label}
          </span>
        )}

        <div
          ref={canvasRef}
          className="relative"
          style={{ width: canvasSize, height: canvasSize }}
          key={layoutKey}
        >
          <svg className="pointer-events-none absolute inset-0 z-[5]" width={canvasSize} height={canvasSize}>
            {showStrandGuide ? (
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill={`hsl(var(--muted) / ${guideFillOpacity})`}
                stroke="none"
              />
            ) : null}
            {strandLoopPath ? (
              <path
                d={strandLoopPath}
                fill="none"
                stroke={isDragOver ? STRAND_CORD.strokeDrag : STRAND_CORD.stroke}
                strokeWidth={Math.max(2.5, STRAND_CORD.widthFactor * scaleFactor)}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={
                  isDragOver
                    ? 1
                    : isStrandComplete
                      ? STRAND_CORD.opacityComplete
                      : STRAND_CORD.opacity
                }
                style={{ transition: "stroke 0.2s, opacity 0.2s" }}
              />
            ) : null}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={isDragOver ? "hsl(var(--primary))" : "hsl(var(--border))"}
              strokeWidth={showStrandGuide ? 1.5 : isDragOver ? 2 : 1}
              strokeDasharray={isDragOver ? "6 3" : showStrandGuide ? "5 5" : "3 4"}
              opacity={isDragOver ? 0.85 : showStrandGuide ? guideRingOpacity : 0.35}
              style={{ transition: "stroke 0.2s, opacity 0.2s" }}
            />
            {showStrandGuide
              ? slotsWithPosition.map((slot) =>
                  slot.placed ? null : (
                    <circle
                      key={`guide-${slot.index}`}
                      cx={slot.x}
                      cy={slot.y}
                      r={slot.emptyDim.width * 0.42}
                      fill="hsl(var(--background) / 0.45)"
                      stroke="hsl(var(--border) / 0.7)"
                      strokeWidth={1}
                    />
                  ),
                )
              : null}
          </svg>

          <SortableContext
            key={`ctx-${layoutKey}-${beadCount}`}
            items={slotsWithPosition.map((slot) => `bead-${slot.index}`)}
          >
            {slotsWithPosition.map((slot) => (
              <SortableBead
                key={slot.index}
                bead={slot.placed}
                position={slot.index}
                x={slot.x}
                y={slot.y}
                slotDim={slot.placed ? slot.slotDim : slot.emptyDim}
                onSlotClick={() => onSlotClick(slot.index, slot.beadSize)}
                onBeadRemove={onBeadRemove ? () => onBeadRemove(slot.index) : undefined}
                isDragActive={activeId !== null}
                emptyGuideMode={
                  slot.placed ? "none" : isStrandEmpty ? "prominent" : "moderate"
                }
                showRemoveAlways={isMobile}
              />
            ))}
          </SortableContext>

          <div
            data-strand-interactive
            className="absolute inset-0 z-10"
            style={{ pointerEvents: activeId ? "none" : "auto" }}
            onDragOver={handleDropZoneDragOver}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDropZoneDrop}
          />

          <DragOverlay dropAnimation={null}>
            {activeBead && activeSlotDim ? (
              <div
                style={{
                  ...getPlacedBeadShellStyle(activeSlotDim, !!getBeadImageUrl(activeBead)),
                  opacity: 0.95,
                  boxShadow: "0 6px 18px rgba(0,0,0,0.22)",
                }}
              >
                {getBeadImageUrl(activeBead) ? (
                  <img
                    src={getBeadImageUrl(activeBead)!}
                    alt=""
                    draggable={false}
                    className="h-full w-full"
                    style={{
                      ...getStrandBeadImageStyle(activeBead.bead),
                      filter: getPlacedBeadImageFilter(),
                    }}
                  />
                ) : null}
              </div>
            ) : null}
          </DragOverlay>

        </div>

        {showStrandGuide ? (
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
                  {BRACELET_COPY.strandSlots(beadCount, defaultBeadSizeMm)}
                </p>
                <p className="mt-1">
                  {BRACELET_COPY.strandWrist(wristSize)} · {BRACELET_COPY.strandHint}
                </p>
              </>
            ) : (
              <>
                <p className="font-display text-xs font-semibold text-foreground sm:text-sm">
                  {placedCount}
                  <span className="font-normal text-muted-foreground"> / {beadCount}</span>
                  <span className="font-body font-normal text-muted-foreground">
                    {" "}
                    · {BRACELET_COPY.summaryRemaining(remainingSlots)} · {BRACELET_COPY.strandWrist(wristSize)}
                  </span>
                </p>
              </>
            )}
          </div>
        ) : (
          <p className="font-display text-xs font-semibold tabular-nums text-foreground/75">
            {placedCount} / {beadCount}
          </p>
        )}
      </div>
    </DndContext>
  );
};

export default SortableCircularStrand;
