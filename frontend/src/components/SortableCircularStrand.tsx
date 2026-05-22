import { useState, useRef } from "react";
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
  getEmptySlotShellStyle,
  getMaxSlotExtent,
  getPlacedBeadImageFilter,
  getPlacedBeadShellStyle,
  getStrandBeadImageStyle,
  type BeadSlotDimensions,
} from "@/render/bead-crop";

interface SortableCircularStrandProps {
  beadCount: number;
  placedBeads: PlacedBead[];
  onBeadsReorder: (beads: PlacedBead[]) => void;
  onSlotClick: (position: number, beadSize: BeadSize) => void;
  onBeadDrop?: (position: number, data: { bead?: PlacedBead["bead"] }) => void;
  label?: string;
  wristSize: number;
  size?: number;
}

interface SortableBeadProps {
  bead: PlacedBead | null;
  position: number;
  x: number;
  y: number;
  slotDim: BeadSlotDimensions;
  onSlotClick: (position: number) => void;
  isDragActive: boolean;
}

function SortableBead({
  bead,
  position,
  x,
  y,
  slotDim,
  onSlotClick,
  isDragActive,
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
      : getEmptySlotShellStyle(slotDim);

  const style: React.CSSProperties = {
    ...shell,
    left: x - slotDim.width / 2,
    top: y - slotDim.height / 2,
    opacity: isDragging ? 0 : bead ? 1 : 0.4,
    transition: isDragActive ? undefined : "opacity 0.15s, transform 0.15s",
    zIndex: 20,
  };

  const label = bead?.bead.name ?? "";
  const title = bead
    ? `${label} (${bead.beadSize}mm) — Drag to reorder`
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
            : `${bead.beadSize}mm`}
        </span>
      )}
    </button>
  );
}

const SortableCircularStrand = ({
  beadCount,
  placedBeads,
  onBeadsReorder,
  onSlotClick,
  onBeadDrop,
  label,
  wristSize: _wristSize,
  size = 320,
}: SortableCircularStrandProps) => {
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

  const defaultBeadSize: BeadSize = 8;

  const slots = Array.from({ length: beadCount }, (_, i) => {
    const angle = (2 * Math.PI * i) / beadCount - Math.PI / 2;
    const placed = placedBeads.find((b) => b.position === i) ?? null;
    const beadSize = placed?.beadSize ?? defaultBeadSize;
    const slotDim = getBeadSlotDimensions(placed, beadSize, scaleFactor);
    return { index: i, angle, placed, beadSize, slotDim };
  });

  const maxExtent = getMaxSlotExtent(slots.map((s) => s.slotDim));
  const radius = center - maxExtent / 2 - strandPadding;

  const slotsWithPosition = slots.map((slot) => {
    const x = center + radius * Math.cos(slot.angle);
    const y = center + radius * Math.sin(slot.angle);
    return { ...slot, x, y };
  });

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
        >
          <svg className="pointer-events-none absolute inset-0" width={canvasSize} height={canvasSize}>
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={isDragOver ? "hsl(var(--primary))" : "hsl(var(--border))"}
              strokeWidth={isDragOver ? 2 : 1}
              strokeDasharray={isDragOver ? "6 3" : "3 4"}
              opacity={isDragOver ? 0.8 : 0.35}
              style={{ transition: "stroke 0.2s, opacity 0.2s" }}
            />
          </svg>

          <SortableContext items={slotsWithPosition.map((slot) => `bead-${slot.index}`)}>
            {slotsWithPosition.map((slot) => (
              <SortableBead
                key={slot.index}
                bead={slot.placed}
                position={slot.index}
                x={slot.x}
                y={slot.y}
                slotDim={slot.slotDim}
                onSlotClick={() => onSlotClick(slot.index, slot.beadSize)}
                isDragActive={activeId !== null}
              />
            ))}
          </SortableContext>

          <div
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

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p
                className="font-display font-semibold text-foreground/70"
                style={{ fontSize: 22 * scaleFactor }}
              >
                {placedBeads.length}
                <span
                  className="font-normal text-muted-foreground/50"
                  style={{ fontSize: 12 * scaleFactor }}
                >
                  /{beadCount}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </DndContext>
  );
};

export default SortableCircularStrand;
