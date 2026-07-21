import { useState, useRef, useCallback, useMemo, useEffect, memo, type KeyboardEvent } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { X, AlertTriangle } from "lucide-react";
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
import { BRACELET_COPY } from "@/features/bracelet/copy";
import { isUnavailablePlacedBead, unavailableIssueForPlaced } from "@/features/bracelet/unavailable-bead";
import {
  getBeadImageUrl,
  getBeadSlotDimensions,
  getGuideSlotDimensions,
  getMaxSlotExtent,
  getBeadStrandTangentContactPx,
  getPlacedBeadShellStyle,
  getStrandBeadImageStyle,
  getStrandBeadRasterSize,
  resolveBeadSlotSizing,
  useStrandRenderConfigCache,
  STRAND_CORD,
  type BeadSlotDimensions,
} from "@/render/bead-crop";
import { normalizeFromSlots, strandCircumferenceMm } from "@/features/bracelet/composition";
import {
  computeStrandRingStrokePx,
  computeWristRingRadiusPx,
  type WristSizeBounds,
} from "@/features/bracelet/strand-ring";
import {
  resolveDropTargetFromLayout,
  type LayoutAngleSector,
} from "@/features/bracelet/strand-elastic-layout";
import { resolveBeadIndexUnderPointer } from "@/features/bracelet/strand-reorder-hit-test";
import { wristCircumferenceMm } from "@/features/bracelet/capacity";
import {
  beadOccupancyArcPx,
} from "@/features/bracelet/strand-ring-geometry";
import {
  computeStrandAdjacencySpacingDebug,
  applyStrandSpacingForceOverrides,
  isStrandSpacingDebugEnabled,
  logStrandAdjacencySpacing,
  logStrandSpacingDataFlow,
} from "@/features/bracelet/strand-adjacency-spacing-debug";
import type { LibraryDragPayload } from "@/components/BeadLibrary";
import { BEAD_LIBRARY_DRAG_TYPE, isLibraryDragEvent } from "@/features/bracelet/interaction";
import {
  computeBeadShellPosition,
  computeBalancedRadialStrandPathLayout,
  pointerAngleOnCanvas,
  strandRotationDeg,
  STRAND_PATH_START_ANGLE,
  strandLayoutShellDimensions,
  type StrandDropTarget,
} from "@/features/bracelet/strand-layout";
import {
  computeStrandContentBounds,
  shiftStrandLayoutToCanvasCenter,
  squareCanvasSizeForBounds,
  computeStrandCanvasFitBoost,
  STRAND_CONTENT_PADDING_PX,
  STRAND_LAYOUT_BASELINE_PX,
  STRAND_RING_EDGE_PADDING_PX,
} from "@/features/bracelet/strand-viewport";
import { cn } from "@/lib/utils";
import type { BeadLibraryEntry } from "@/types/beads";
import { useCatalogue } from "@/state/catalogue";
import type { BeadSlotSizingCatalogueContext } from "@/render/bead-crop";

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
  onStrandDragActiveChange?: (active: boolean) => void;
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
  shellLeft: number;
  shellTop: number;
  transformOriginX: number;
  transformOriginY: number;
  rotationDeg: number;
  slotDim: BeadSlotDimensions;
  renderDim: BeadSlotDimensions;
  zIndex: number;
  onSlotClick: (position: number) => void;
  onBeadRemove?: (position: number) => void;
  isDragActive: boolean;
  emptyGuideMode: EmptySlotGuideMode;
  showRemoveAlways?: boolean;
  isSelected?: boolean;
  isSwapTarget?: boolean;
  libraryDragActive?: boolean;
  ringCenterX: number;
  ringCenterY: number;
  scaleFactor: number;
  sizingCatalogue?: BeadSlotSizingCatalogueContext;
}

function SortableBeadInner({
  bead,
  position,
  shellLeft,
  shellTop,
  transformOriginX,
  transformOriginY,
  rotationDeg,
  slotDim,
  renderDim,
  zIndex,
  onSlotClick,
  onBeadRemove,
  isDragActive,
  emptyGuideMode,
  showRemoveAlways = false,
  isSelected = false,
  isSwapTarget = false,
  libraryDragActive = false,
  ringCenterX,
  ringCenterY,
  scaleFactor,
  sizingCatalogue,
}: SortableBeadProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: `bead-${position}`,
    disabled: !bead || libraryDragActive || (bead ? isUnavailablePlacedBead(bead) : false),
  });

  const unavailable = bead ? isUnavailablePlacedBead(bead) : false;
  const unavailableIssue = bead ? unavailableIssueForPlaced(bead) : null;

  const imgSrc = unavailable ? "" : getBeadImageUrl(bead, sizingCatalogue);
  const hasImage = !!imgSrc;
  const mm = bead ? placedBeadSizeMm(bead) : 0;
  const shell = hasImage
    ? getPlacedBeadShellStyle(renderDim, true)
    : getPlacedBeadShellStyle(renderDim, false);

  const isEmptySlot = !bead;
  const outerStyle: React.CSSProperties = {
    ...shell,
    left: shellLeft,
    top: shellTop,
    width: renderDim.width,
    height: renderDim.height,
    opacity: isDragging ? 0.4 : bead ? 1 : emptyGuideMode === "prominent" ? 1 : 0.78,
    transition:
      isDragActive || libraryDragActive
        ? undefined
        : "left 0.35s ease-out, top 0.35s ease-out, opacity 0.15s, transform 0.15s",
    zIndex: isEmptySlot && libraryDragActive ? 35 : zIndex,
    pointerEvents: isDragging ? "none" : bead && libraryDragActive ? "none" : "auto",
    transformOrigin: `${transformOriginX}px ${transformOriginY}px`,
    transform: beadShellTransform(rotationDeg, { dragOverlay: isDragging }),
    boxShadow: isDragging ? "0 4px 12px rgba(0,0,0,0.12)" : shell.boxShadow,
  };

  const slotExtent = Math.max(renderDim.width, renderDim.height);
  const ringAnchorX = shellLeft + transformOriginX;
  const ringAnchorY = shellTop + transformOriginY;
  const outward = computeBeadOutwardOffset(ringAnchorX, ringAnchorY, ringCenterX, ringCenterY, rotationDeg, slotExtent);
  const removeBtnSize = Math.max(18, Math.min(22, slotExtent * 0.4));

  const label = unavailable ? BRACELET_COPY.unavailableBeadName : (bead?.bead.name ?? "");
  const title = unavailable
    ? `${BRACELET_COPY.unavailableBeadName} · ${BRACELET_COPY.unavailableBeadPrompt}`
    : bead
      ? `${label} · ${bead.size.label} — ${BRACELET_COPY.dragToReorder}`
      : BRACELET_COPY.emptySlotHint;

  const handleEmptySlotKeyDown = (e: KeyboardEvent) => {
    if (bead || libraryDragActive) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSlotClick(position);
    }
  };

  const sizing = bead
    ? resolveBeadSlotSizing(bead, placedBeadSizeMm(bead), scaleFactor, sizingCatalogue)
    : null;

  return (
    <div
      ref={setNodeRef}
      data-strand-slot
      {...(bead ? { "data-bead-index": position } : {})}
      style={outerStyle}
      {...(bead && !libraryDragActive ? { ...attributes, ...listeners } : {})}
      role={isEmptySlot ? "button" : undefined}
      tabIndex={isEmptySlot && !libraryDragActive ? 0 : undefined}
      onClick={() => {
        if (libraryDragActive) return;
        if (!bead || unavailable) onSlotClick(position);
      }}
      onKeyDown={handleEmptySlotKeyDown}
      className={cn(
        "absolute group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        bead
          ? cn(
              unavailable
                ? "cursor-pointer border-2 border-dashed border-destructive/50 bg-destructive/5"
                : "cursor-grab bg-transparent active:cursor-grabbing",
              !unavailable && "transition-transform duration-200 ease-out",
              !unavailable && "hover:scale-[1.02]",
              isDragging && "cursor-grabbing",
              isSelected && "ring-2 ring-inset ring-primary/45",
              isSwapTarget && "ring-2 ring-inset ring-primary/60",
              unavailable && "ring-2 ring-inset ring-destructive/40",
            )
          : "cursor-pointer state-hoverable",
      )}
      title={title}
      aria-label={isEmptySlot ? BRACELET_COPY.emptySlotHint : title}
    >
      {hasImage && bead ? (
        <div
          className="relative h-full w-full overflow-visible"
          style={{ width: renderDim.width, height: renderDim.height }}
        >
          <img
            src={imgSrc}
            alt=""
            draggable={false}
            loading="lazy"
            decoding="async"
            {...getStrandBeadRasterSize(sizing?.imageDimensions ?? renderDim)}
            className="pointer-events-none select-none"
            style={getStrandBeadImageStyle(bead.bead, sizing)}
          />
        </div>
      ) : null}
      {unavailable && bead ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-center">
          <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
          <span className="text-[9px] font-medium leading-tight text-destructive">
            {BRACELET_COPY.unavailableBeadName}
          </span>
          <span className="text-[8px] leading-tight text-muted-foreground">
            {unavailableIssue === "deleted"
              ? BRACELET_COPY.unavailableBeadDeleted
              : BRACELET_COPY.unavailableBeadStatus}
          </span>
          <span className="text-[8px] font-medium leading-tight text-primary">
            {BRACELET_COPY.unavailableBeadPrompt}
          </span>
        </div>
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

const SortableBead = memo(SortableBeadInner, (prev, next) =>
  prev.position === next.position &&
  prev.bead === next.bead &&
  prev.shellLeft === next.shellLeft &&
  prev.shellTop === next.shellTop &&
  prev.transformOriginX === next.transformOriginX &&
  prev.transformOriginY === next.transformOriginY &&
  prev.rotationDeg === next.rotationDeg &&
  prev.slotDim.width === next.slotDim.width &&
  prev.slotDim.height === next.slotDim.height &&
  prev.renderDim.width === next.renderDim.width &&
  prev.renderDim.height === next.renderDim.height &&
  prev.zIndex === next.zIndex &&
  prev.isDragActive === next.isDragActive &&
  prev.emptyGuideMode === next.emptyGuideMode &&
  prev.showRemoveAlways === next.showRemoveAlways &&
  prev.isSelected === next.isSelected &&
  prev.isSwapTarget === next.isSwapTarget &&
  prev.libraryDragActive === next.libraryDragActive &&
  prev.ringCenterX === next.ringCenterX &&
  prev.ringCenterY === next.ringCenterY &&
  prev.scaleFactor === next.scaleFactor &&
  prev.sizingCatalogue === next.sizingCatalogue,
);

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
  onStrandDragActiveChange,
  pathStartAngle = STRAND_PATH_START_ANGLE,
  wristSizeBounds,
  size = 320,
  layoutKey = 0,
}: SortableCircularStrandProps) => {
  const isMobile = useIsMobile();
  const { beadSizes, beadLibrarySizes, beadTypes, subBeadTypes, strandRenderDefaults } = useCatalogue();
  const sizingCatalogue = useMemo<BeadSlotSizingCatalogueContext>(
    () => ({ beadSizes, beadLibrarySizes, beadTypes, subBeadTypes, strandRenderDefaults }),
    [beadSizes, beadLibrarySizes, beadTypes, subBeadTypes, strandRenderDefaults],
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragClientPos, setDragClientPos] = useState<{ x: number; y: number } | null>(null);
  const [isLibraryDragOver, setIsLibraryDragOver] = useState(false);
  const [reorderHintVisible, setReorderHintVisible] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragClientStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragRafRef = useRef<number | null>(null);
  const pendingDragPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastHoverKeyRef = useRef<string | null>(null);
  const reorderSourceRef = useRef<{ sourceIndex: number; sourceBeadId: string } | null>(null);

  const publishHoverTarget = useCallback(
    (target: StrandDropTarget | null) => {
      const key = target ? dropTargetKey(target) : null;
      if (key === lastHoverKeyRef.current) return;
      lastHoverKeyRef.current = key;
      onHoverDropTarget?.(target);
    },
    [onHoverDropTarget],
  );

  const publishReorderTargetIndex = useCallback(
    (targetIndex: number | null) => {
      const key = targetIndex === null ? null : `swap-${targetIndex}`;
      if (key === lastHoverKeyRef.current) return;
      lastHoverKeyRef.current = key;
      onHoverDropTarget?.(
        targetIndex === null ? null : { mode: "replace", index: targetIndex },
      );
    },
    [onHoverDropTarget],
  );

  const resolveReorderTargetIndex = useCallback(
    (clientX: number, clientY: number, sourceIndex: number | null): number | null =>
      resolveBeadIndexUnderPointer(clientX, clientY, {
        boundary: canvasRef.current,
        excludeIndex: sourceIndex,
      }),
    [],
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
  const placedLibraries = useMemo(
    () => normalized.map((placed) => placed.bead).filter((bead): bead is BeadLibraryEntry => Boolean(bead)),
    [normalized],
  );
  const { getForBead } = useStrandRenderConfigCache({
    beadTypes,
    subBeadTypes,
    beadLibraries: placedLibraries,
    strandRenderDefaults,
  });
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
      shellLeft: number;
      shellTop: number;
      transformOriginX: number;
      transformOriginY: number;
      placed: PlacedBead | null;
      beadSize: number;
      slotDim: BeadSlotDimensions;
      renderDim: BeadSlotDimensions;
      zIndex: number;
      layoutDim: BeadSlotDimensions;
      emptyDim: BeadSlotDimensions;
      isInsertionSlot: boolean;
    };

    const buildLayout = (beadScaleBoost: number) => {
      const scaleFactor = (canvasSize / STRAND_LAYOUT_BASELINE_PX) * beadScaleBoost;
      const ringStrokeHalf = computeStrandRingStrokePx(scaleFactor) / 2;
      const guideSlotDim = getGuideSlotDimensions(scaleFactor, guideSizeMm);

      let slotsWithPosition: StrandSlot[] = [];
      let maxExtent = Math.max(guideSlotDim.width, guideSlotDim.height);
      let prelimDims: BeadSlotDimensions[] = [];
      let sizingResults: ReturnType<typeof resolveBeadSlotSizing>[] = [];

      if (!isStrandEmpty) {
        sizingResults = normalized.map((placed) =>
          resolveBeadSlotSizing(placed, placedBeadSizeMm(placed), scaleFactor, sizingCatalogue),
        );
        prelimDims = sizingResults.map((s) => s.dimensions);
        maxExtent = getMaxSlotExtent(prelimDims);
      }

      const renderProfiles = applyStrandSpacingForceOverrides(
        normalized.map((placed) => getForBead(placed.bead)),
      );

      if (isStrandSpacingDebugEnabled() && normalized[0]) {
        logStrandSpacingDataFlow({
          bead: normalized[0]!.bead,
          catalogue: sizingCatalogue,
          resolved: renderProfiles[0]!,
        });
      }

      const bounds =
        wristSizeBounds.minCm > 0 && wristSizeBounds.maxCm > 0
          ? wristSizeBounds
          : { minCm: wristSize, maxCm: wristSize };
      const wristRadius = computeWristRingRadiusPx(
        center,
        wristSize,
        scaleFactor,
        maxExtent,
        bounds,
        ringStrokeHalf,
      );

      let radius = wristRadius;
      let layoutSectors: LayoutAngleSector[] = [];
      let insertionAngles: number[] = [];

      if (!isStrandEmpty) {
        const ringCircumferencePx = 2 * Math.PI * wristRadius;
        const wristMm = wristCircumferenceMm(wristSize);
        const occupancyMm = normalized.map((placed) => placedBeadSizeMm(placed));
        const occupancy = beadOccupancyArcPx(occupancyMm, wristMm, ringCircumferencePx);
        const renderDims = prelimDims.map((slotDim, i) =>
          strandLayoutShellDimensions(slotDim, renderProfiles[i]!),
        );
        const visualDiametersPx = sizingResults.map((sizing, i) => {
          const slotWidth = Math.max(prelimDims[i]!.width, 1e-6);
          const renderScale = renderDims[i]!.width / slotWidth;
          return getBeadStrandTangentContactPx(sizing) * renderScale;
        });

        // Single shared source of truth: beads are packed contiguously using the SAME
        // occupancy the capacity panel sums (sizeMm → arc). Each bead's footprint is exactly
        // its occupancy arc, so cumulative placement equals Σ occupancyMm and a 100%-full
        // strand tiles the whole ring with no empty arc. Occupancy-aware largest-gap insertion
        // grows top → bottom → right → left, then recursively fills the remaining free arcs.
        // No contact-width multiplier, minimum separation, or visual-silhouette enlargement is
        // applied here — those would make rendered occupancy diverge from reported used length.
        const sequential = computeBalancedRadialStrandPathLayout({
          beads: normalized.map((_, i) => ({
            index: i,
            occupancyPx: occupancy.contactArcPx[i]!,
            visualRadiusPx: occupancy.contactArcPx[i]! / 2,
            contactAdjustmentPx: 0,
          })),
          centerX: center,
          centerY: center,
          radius: wristRadius,
          startAngle: pathStartAngle,
        });
        const pathLayout = sequential.beads;
        insertionAngles = sequential.insertionAngles;

        layoutSectors = pathLayout.map((path) => ({
          index: path.index,
          angle: path.angle,
          arcSpan: path.arcSpan,
        }));

        if (isStrandSpacingDebugEnabled()) {
          const capacityUsedMm = occupancyMm.reduce((a, b) => a + b, 0);
          const targetLength = wristMm;
          // Derive the occupied length straight from the rendered layout (px → mm) so the
          // number logged here is exactly what is drawn, not a parallel estimate.
          const pxToMm = targetLength / Math.max(ringCircumferencePx, 1e-6);
          const renderedOccupiedMm = sequential.occupiedArcPx * pxToMm;
          const totalAngularLength =
            (sequential.occupiedArcPx / ringCircumferencePx) * 2 * Math.PI;
          const beadCount = occupancyMm.length;
          const averageSpacingMm = beadCount ? renderedOccupiedMm / beadCount : 0;
          let accumMm = 0;
          for (let i = 0; i < occupancyMm.length; i++) {
            const effectiveDiameterMm = occupancyMm[i]!;
            accumMm += occupancyMm[i]!;
            const angleDeg = ((pathLayout[i]!.angle * 180) / Math.PI + 360) % 360;
            console.log(
              [
                `[strand-occupancy] bead ${i}`,
                `type=${normalized[i]!.bead?.beadTypeSlug ?? "?"}`,
                `effectiveDiameter=${effectiveDiameterMm.toFixed(2)}mm`,
                `arcSpan=${((pathLayout[i]!.arcSpan * 180) / Math.PI).toFixed(2)}deg`,
                `accumUsed=${accumMm.toFixed(2)}mm`,
                `angleDeg=${angleDeg.toFixed(1)}`,
              ].join(" | "),
            );
          }
          console.log(
            [
              `[strand-occupancy] braceletCircumference=${targetLength.toFixed(1)}mm`,
              `occupiedLength(render)=${renderedOccupiedMm.toFixed(1)}mm`,
              `occupiedLength(capacity)=${capacityUsedMm.toFixed(1)}mm`,
              `remainingLength=${Math.max(0, targetLength - renderedOccupiedMm).toFixed(1)}mm`,
              `beads=${beadCount}`,
              `averageBeadSpacing=${averageSpacingMm.toFixed(2)}mm`,
              `totalRenderedArc=${((totalAngularLength * 180) / Math.PI).toFixed(1)}deg`,
              `fillRatio=${Math.min(renderedOccupiedMm / targetLength, 1).toFixed(3)}`,
              `overCapacity=${sequential.isOverCapacity}`,
            ].join(" | "),
          );
          logStrandAdjacencySpacing(
            computeStrandAdjacencySpacingDebug({
              sizingResults,
              profiles: renderProfiles,
              contactArcPx: occupancy.contactArcPx.map((arc, i) =>
                Math.max(arc, visualDiametersPx[i]!),
              ),
              leadingOverlapPx: occupancy.leadingOverlapPx,
              trailingOverlapPx: occupancy.trailingOverlapPx,
              angles: pathLayout.map((path) => path.angle),
              radiusPx: radius,
              beadPositions: pathLayout.map((path) => ({ x: path.x, y: path.y })),
            }),
          );
        }

        slotsWithPosition = normalized.map((placed, i) => {
          const beadSize = placedBeadSizeMm(placed);
          const slotDim = prelimDims[i]!;
          const profile = renderProfiles[i]!;
          const renderDim = renderDims[i]!;
          const path = pathLayout[i]!;
          const shellPos = computeBeadShellPosition(path.x, path.y, path.angle, slotDim, profile);
          return {
            index: i,
            angle: path.angle,
            arcSpan: path.arcSpan,
            rotationDeg: strandRotationDeg(path.angle, profile),
            x: path.x,
            y: path.y,
            shellLeft: shellPos.left,
            shellTop: shellPos.top,
            transformOriginX: shellPos.transformOriginX,
            transformOriginY: shellPos.transformOriginY,
            placed,
            beadSize,
            slotDim,
            renderDim,
            // DOM/stacking order follows the sequence exactly; type-level zPriority must
            // never make an earlier charm paint above a later crystal.
            zIndex: 20 + i,
            layoutDim: slotDim,
            emptyDim: slotDim,
            isInsertionSlot: false,
          };
        });
      }

      return { slotsWithPosition, scaleFactor, center, radius, layoutSectors, insertionAngles, ringStrokeHalf };
    };

    const base = buildLayout(1);

    const measureRequiredCanvas = (laidOut: ReturnType<typeof buildLayout>) => {
      const edgePad = STRAND_RING_EDGE_PADDING_PX * laidOut.scaleFactor + STRAND_CONTENT_PADDING_PX;
      const bounds = computeStrandContentBounds(
        laidOut.slotsWithPosition.map((slot) => ({
          x: slot.shellLeft + slot.renderDim.width / 2,
          y: slot.shellTop + slot.renderDim.height / 2,
          width: slot.renderDim.width,
          height: slot.renderDim.height,
        })),
        laidOut.radius,
        laidOut.center,
        laidOut.ringStrokeHalf,
      );
      return squareCanvasSizeForBounds(bounds, edgePad);
    };

    let scaleBoost = 1;
    let laidOut = base;
    let requiredCanvas = measureRequiredCanvas(laidOut);

    for (let attempt = 0; attempt < 8 && requiredCanvas > canvasSize; attempt++) {
      const nextBoost = scaleBoost * computeStrandCanvasFitBoost(requiredCanvas, canvasSize);
      if (nextBoost >= scaleBoost) break;
      scaleBoost = nextBoost;
      laidOut = buildLayout(scaleBoost);
      requiredCanvas = measureRequiredCanvas(laidOut);
    }

    const effectiveCanvasSize = canvasSize;
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
  }, [normalized, canvasSize, guideSizeMm, isStrandEmpty, wristSize, wristSizeBounds, pathStartAngle, sizingCatalogue, getForBead]);

  const renderCanvasSize = canvasSize;
  const ringStrokeWidth = computeStrandRingStrokePx(scaleFactor);

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
    onStrandDragActiveChange?.(true);
    const id = event.active.id as string;
    setActiveId(id);
    const from = parseSlotId(id);
    const sourceBead = from !== null ? normalized[from] : undefined;
    reorderSourceRef.current =
      from !== null && sourceBead
        ? { sourceIndex: from, sourceBeadId: sourceBead.bead.id }
        : null;
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
    const sourceIndex = reorderSourceRef.current?.sourceIndex ?? parseSlotId(activeId);
    const targetIndex = resolveReorderTargetIndex(pos.x, pos.y, sourceIndex);
    publishReorderTargetIndex(targetIndex);
  };

  const finishStrandDrag = () => {
    onStrandDragActiveChange?.(false);
    reorderSourceRef.current = null;
    setActiveId(null);
    dragClientStartRef.current = null;
    setDragClientPos(null);
    lastHoverKeyRef.current = null;
    publishReorderTargetIndex(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const source = reorderSourceRef.current;
    const sourceIndex = source?.sourceIndex ?? parseSlotId(event.active.id);
    const start = dragClientStartRef.current;
    const pointer = start
      ? { x: start.x + event.delta.x, y: start.y + event.delta.y }
      : null;
    const targetIndex =
      pointer && sourceIndex !== null
        ? resolveReorderTargetIndex(pointer.x, pointer.y, sourceIndex)
        : null;
    if (sourceIndex !== null && targetIndex !== null && sourceIndex !== targetIndex) {
      onBeadsReorder(sourceIndex, targetIndex);
    }
    finishStrandDrag();
  };

  const activeBead = activeId
    ? normalized.find((b) => `bead-${b.position}` === activeId)
    : null;

  const activeSizing = activeBead
    ? resolveBeadSlotSizing(activeBead, placedBeadSizeMm(activeBead), scaleFactor, sizingCatalogue)
    : null;

  const activeSlotDim = activeSizing?.dimensions ?? null;

  const activeRotationDeg = activeBead
    ? (renderSlots.find((s) => s.index === activeBead.position)?.rotationDeg ?? 0)
    : 0;

  const externalDrag = libraryDragActive || isLibraryDragOver;
  const dropZoneInteractive = externalDrag || activeId === null;
  const libraryDropHover = externalDrag && hoverDropTarget ? hoverDropTarget : null;
  const reorderHover =
    !externalDrag && activeId !== null && hoverDropTarget ? hoverDropTarget : null;
  const reorderSwapTargetIndex =
    reorderHover?.mode === "replace" ? reorderHover.index : null;
  const draggingFromIndex = activeId ? parseSlotId(activeId) : null;

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
        finishStrandDrag();
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
            "surface-canvas relative",
            activeId && !externalDrag && "cursor-grabbing",
          )}
          style={{ width: renderCanvasSize, height: renderCanvasSize }}
          key={layoutKey}
          data-strand-canvas
          data-strand-content-size={renderCanvasSize}
        >
          {activeBead && activeSlotDim && dragClientPos ? (() => {
            const { x: localX, y: localY } = clientToCanvas(dragClientPos.x, dragClientPos.y);
            const dragImgUrl = getBeadImageUrl(activeBead, sizingCatalogue);
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
                  opacity: 0.94,
                  transformOrigin: "center center",
                  transform: beadShellTransform(activeRotationDeg, { dragOverlay: true }),
                }}
              >
                {hasImage ? (
                  <div
                    className="relative overflow-visible"
                    style={{ width: activeSlotDim.width, height: activeSlotDim.height }}
                  >
                    <img
                      src={dragImgUrl!}
                      alt=""
                      draggable={false}
                      decoding="async"
                      {...getStrandBeadRasterSize(activeSizing?.imageDimensions ?? activeSlotDim)}
                      className="pointer-events-none"
                      style={getStrandBeadImageStyle(activeBead.bead, activeSizing)}
                    />
                  </div>
                ) : null}
              </div>
            );
          })() : null}
          <svg
            data-strand-ring
            className="pointer-events-none absolute inset-0 z-[5] h-full w-full"
            viewBox={`0 0 ${renderCanvasSize} ${renderCanvasSize}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ transition: activeId || externalDrag ? undefined : "opacity 0.25s ease-out" }}
          >
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={externalDrag ? STRAND_CORD.strokeDrag : STRAND_CORD.stroke}
              strokeWidth={ringStrokeWidth}
              opacity={externalDrag ? 1 : STRAND_CORD.opacity}
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
                shellLeft={slot.shellLeft}
                shellTop={slot.shellTop}
                transformOriginX={slot.transformOriginX}
                transformOriginY={slot.transformOriginY}
                rotationDeg={slot.rotationDeg}
                slotDim={slot.slotDim}
                renderDim={slot.renderDim}
                zIndex={slot.zIndex}
                onSlotClick={onSlotClick}
                onBeadRemove={onBeadRemove}
                isDragActive={activeId !== null}
                emptyGuideMode="none"
                showRemoveAlways={isMobile}
                isSelected={selectedPosition === slot.index}
                isSwapTarget={
                  reorderSwapTargetIndex === slot.index && draggingFromIndex !== slot.index
                }
                libraryDragActive={externalDrag}
                ringCenterX={center}
                ringCenterY={center}
                scaleFactor={scaleFactor}
                sizingCatalogue={sizingCatalogue}
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
                : libraryDragPreview?.bead?.beadTypeSlug === "charm"
                  ? BRACELET_COPY.dropCharmInsertHint
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
          ) : isStrandEmpty ? null : (
            <p className="type-small font-medium text-foreground sm:text-body">
              {placedCount} {BRACELET_COPY.piecesOnStrand} · {BRACELET_COPY.strandLength(compositionMm)}
            </p>
          )}
        </div>
      </div>
    </DndContext>
  );
};

export default SortableCircularStrand;
