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

interface SortableCircularStrandProps {
  beadCount: number;
  placedBeads: PlacedBead[];
  onBeadsReorder: (beads: PlacedBead[]) => void;
  onSlotClick: (position: number, beadSize: BeadSize) => void;
  onBeadDrop?: (position: number, data: any) => void;
  label?: string;
  wristSize: number;
  size?: number;
}

interface SortableBeadProps {
  bead: PlacedBead | null;
  position: number;
  x: number;
  y: number;
  beadPixelSize: number;
  onSlotClick: (position: number) => void;
  isDragActive: boolean;
}

function getBeadBackground(bead: PlacedBead | null): string {
  if (!bead) return "hsl(var(--muted))";
  if (bead.type === "crystal" && bead.crystal?.image) return "transparent";
  if (bead.type === "charm" && bead.charm?.image) return "transparent";
  if (bead.type === "spacer" && bead.spacer?.image) return "transparent";
  if (bead.type === "charm") return "hsl(43 60% 70%)";
  if (bead.type === "spacer") return "hsl(0 0% 82%)";
  return "hsl(var(--muted))";
}

function getBeadImageSrc(bead: PlacedBead | null): string | null {
  if (bead?.type === "crystal" && bead.crystal?.image) {
    const isDataUrl = bead.crystal.image.startsWith("data:");
    return bead.crystal.image + (isDataUrl ? "" : "?v=2");
  }
  if (bead?.type === "charm" && bead.charm?.image) return bead.charm.image;
  if (bead?.type === "spacer" && bead.spacer?.image) return bead.spacer.image;
  return null;
}

function getBeadLabel(bead: PlacedBead | null): string {
  if (!bead) return "";
  if (bead.type === "crystal" && bead.crystal) return bead.crystal.name;
  if (bead.type === "charm" && bead.charm) return bead.charm.name;
  if (bead.type === "spacer" && bead.spacer) return bead.spacer.name;
  return "";
}

function getBeadShape(bead: PlacedBead | null): string {
  if (!bead) return "rounded-full";
  if (bead.type === "charm") return "rounded-md";
  if (bead.type === "spacer") return "rounded-full";
  return "rounded-full";
}

function SortableBead({
  bead,
  position,
  x,
  y,
  beadPixelSize,
  onSlotClick,
  isDragActive,
}: SortableBeadProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useSortable({
    id: `bead-${position}`,
  });

  const hasImage = !!getBeadImageSrc(bead);
  const shape = getBeadShape(bead);

  const style: React.CSSProperties = {
    width: beadPixelSize,
    height: beadPixelSize,
    left: x - beadPixelSize / 2,
    top: y - beadPixelSize / 2,
    background: hasImage ? "transparent" : getBeadBackground(bead),
    border: hasImage ? "none" : undefined,
    borderColor: !hasImage && bead ? "transparent" : !hasImage ? "hsl(var(--border))" : undefined,
    boxShadow: !hasImage && bead ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
    opacity: isDragging ? 0 : 1,
    transition: isDragActive ? undefined : "opacity 0.15s, background 0.2s",
    zIndex: 20,
  };

  const label = getBeadLabel(bead);
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
      className={`absolute transition-all duration-200 hover:scale-110 active:scale-95 group ${
        hasImage
          ? "cursor-grab active:cursor-grabbing"
          : bead
          ? `border ${shape} cursor-grab active:cursor-grabbing`
          : "border rounded-full cursor-pointer hover:border-primary/60"
      }`}
      title={title}
    >
      {bead && (
        <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          {bead.type === "charm" ? label : bead.type === "spacer" ? label : `${bead.beadSize}mm`}
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
  wristSize,
  size = 320,
}: SortableCircularStrandProps) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const canvasSize = size;
  const center = canvasSize / 2;
  const radius = canvasSize / 2 - (canvasSize * 36) / 320;
  const scaleFactor = canvasSize / 320;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const slots = Array.from({ length: beadCount }, (_, i) => {
    const angle = (2 * Math.PI * i) / beadCount - Math.PI / 2;
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);
    const placed = placedBeads.find((b) => b.position === i);
    const beadPixelSize = placed ? placed.beadSize * 2.5 * scaleFactor : 20 * scaleFactor;
    return { index: i, x, y, placed, beadPixelSize };
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
            b.position === draggedBead.position ? { ...b, position: targetPosition } : b
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
    slots.forEach((slot) => {
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
      const data = JSON.parse(raw);
      const slotIndex = findNearestSlot(e.clientX, e.clientY);
      onBeadDrop(slotIndex, data);
    } catch (err) {
      console.error("Failed to parse dropped bead data:", err);
    }
  };

  const activeBead = activeId
    ? placedBeads.find((b) => `bead-${b.position}` === activeId)
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
          <span className="text-xs font-body text-muted-foreground uppercase tracking-widest">
            {label}
          </span>
        )}

        <div
          ref={canvasRef}
          className="relative"
          style={{ width: canvasSize, height: canvasSize }}
        >
          <svg className="absolute inset-0" width={canvasSize} height={canvasSize}>
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={isDragOver ? "hsl(var(--primary))" : "hsl(var(--border))"}
              strokeWidth={isDragOver ? 2 : 1.5}
              strokeDasharray="4 3"
              style={{ transition: "stroke 0.2s" }}
            />
          </svg>

          {slots.map((slot) => {
            if (!slot.placed || `bead-${slot.index}` === activeId) return null;
            const imgSrc = getBeadImageSrc(slot.placed);
            if (!imgSrc) return null;
            const displaySize = slot.beadPixelSize * 2;
            return (
              <img
                key={`bead-img-${slot.index}`}
                src={imgSrc}
                alt=""
                draggable={false}
                style={{
                  position: "absolute",
                  left: slot.x - displaySize / 2,
                  top: slot.y - displaySize / 2,
                  width: displaySize,
                  height: displaySize,
                  objectFit: "contain",
                  pointerEvents: "none",
                  userSelect: "none",
                  zIndex: 19,
                  borderRadius: slot.placed.type === "charm" ? 4 : "50%",
                }}
              />
            );
          })}

          <SortableContext items={slots.map((slot) => `bead-${slot.index}`)}>
            {slots.map((slot) => (
              <SortableBead
                key={slot.index}
                bead={slot.placed || null}
                position={slot.index}
                x={slot.x}
                y={slot.y}
                beadPixelSize={slot.beadPixelSize}
                onSlotClick={() => onSlotClick(slot.index, slot.placed?.beadSize || 8)}
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
            {activeBead ? (() => {
              const baseGhost = activeBead.beadSize === 6 ? 18 : activeBead.beadSize === 8 ? 22 : 26;
              const ghostSize = baseGhost * scaleFactor;
              const ghostImgSrc = getBeadImageSrc(activeBead);
              const ghostShape = activeBead.type === "charm" ? "rounded-md" : "rounded-full";
              return (
                <div
                  className={`border-2 border-primary shadow-xl ${ghostImgSrc ? ghostShape : ghostShape}`}
                  style={{
                    width: ghostSize,
                    height: ghostSize,
                    background: getBeadBackground(activeBead),
                    opacity: 0.9,
                    position: "relative",
                  }}
                >
                  {ghostImgSrc && (
                    <img
                      src={ghostImgSrc}
                      alt=""
                      draggable={false}
                      style={{
                        position: "absolute",
                        width: "200%",
                        height: "200%",
                        top: "-50%",
                        left: "-50%",
                        objectFit: "contain",
                        pointerEvents: "none",
                      }}
                    />
                  )}
                </div>
              );
            })() : null}
          </DragOverlay>

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="font-display font-semibold text-foreground" style={{ fontSize: 24 * scaleFactor }}>
                {placedBeads.length}
              </p>
              <p className="text-muted-foreground font-body uppercase tracking-wider" style={{ fontSize: 10 * scaleFactor }}>
                of {beadCount}
              </p>
            </div>
          </div>
        </div>
      </div>
    </DndContext>
  );
};

export default SortableCircularStrand;
