import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Package } from "lucide-react";

import type { OrderSnapshot, OrderSnapshotBracelet } from "@bino-foundry/shared/types";

import SortableCircularStrand from "@/components/SortableCircularStrand";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BuilderPreviewFitScope } from "@/features/builder/components/BuilderPreviewFitScope";
import {
  StrandStage,
  StrandViewport,
  StrandZoomControls,
  catalogueWristSizeBounds,
  measureStrandCanvasSize,
  useStrandZoom,
  BRACELET_COPY,
} from "@/features/bracelet";
import { MATCHING_PAIR_CHROME_HEIGHT_PX } from "@/features/bracelet/strand-camera";
import { buildPlacedFromOrderBracelet } from "@/features/bracelet/load-order-bracelet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useCatalogue } from "@/state/catalogue";

const VIEWER_FALLBACK_CANVAS_PX = 420;

function useOrderViewerCanvasSize(enabled: boolean, twinning: boolean) {
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const [strandSize, setStrandSize] = useState(VIEWER_FALLBACK_CANVAS_PX);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const measure = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setContainerSize({ width: rect.width, height: rect.height });
    setStrandSize(
      measureStrandCanvasSize({
        containerWidth: rect.width,
        containerHeight: rect.height,
        isMobile,
        twinning,
        libraryOpen: false,
      }),
    );
  }, [isMobile, twinning]);

  useEffect(() => {
    if (!enabled) return;
    measure();
    const node = containerRef.current;
    if (!node) return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [enabled, measure]);

  return { containerRef, strandSize, containerSize };
}

function OrderBraceletStrandViewer({
  bracelet,
  open,
}: {
  bracelet: OrderSnapshotBracelet;
  open: boolean;
}) {
  const {
    beadLibraries,
    beadLibrarySizes,
    wristSizes,
    beadAvailabilityStatuses,
    isLoading,
  } = useCatalogue();

  const placed = useMemo(
    () =>
      buildPlacedFromOrderBracelet(bracelet, {
        beadLibraries,
        beadLibrarySizes,
        wristSizes,
        beadAvailabilityStatuses,
      }),
    [bracelet, beadLibraries, beadLibrarySizes, wristSizes, beadAvailabilityStatuses],
  );

  const twinning = placed.twinning;
  const { containerRef, strandSize, containerSize } = useOrderViewerCanvasSize(open, twinning);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [panMode, setPanMode] = useState(true);

  const wristSizeBounds = useMemo(() => {
    const fromCatalogue = catalogueWristSizeBounds(wristSizes);
    if (wristSizes.length) return fromCatalogue;
    const values = [placed.wristSizeCmA, twinning ? placed.wristSizeCmB : placed.wristSizeCmA];
    return {
      minCm: Math.min(...values),
      maxCm: Math.max(...values),
    };
  }, [wristSizes, placed.wristSizeCmA, placed.wristSizeCmB, twinning]);

  const layoutCanvasSize = strandSize;
  const strandZoomLayout = useMemo(
    () => ({
      viewportWidthPx: containerSize.width,
      viewportHeightPx: containerSize.height,
      layoutCanvasSize,
      twinning,
    }),
    [containerSize.width, containerSize.height, layoutCanvasSize, twinning],
  );
  const layoutReady =
    containerSize.width > 0 && containerSize.height > 0 && layoutCanvasSize > 0;

  const {
    displayZoom,
    viewScale,
    pan,
    matchingPairLayout,
    isPanning,
    zoomIn,
    zoomOut,
    reset,
    onPanPointerDown,
    onPanPointerMove,
    onPanPointerUp,
    onPanPointerCancel,
  } = useStrandZoom(
    {
      zoomSurfaceRef: containerRef as RefObject<HTMLElement | null>,
      containerRef: containerRef as RefObject<HTMLElement | null>,
      viewportRef: viewportRef as RefObject<HTMLElement | null>,
      contentRef: contentRef as RefObject<HTMLElement | null>,
    },
    strandZoomLayout,
    { panMode, layoutReady },
  );

  const layoutKey = useMemo(
    () =>
      [
        placed.wristSizeCmA,
        placed.wristSizeCmB,
        placed.placedBeadsA.map((b) => `${b.position}:${b.size.offerKey}`).join(","),
        placed.placedBeadsB.map((b) => `${b.position}:${b.size.offerKey}`).join(","),
        placed.usedFrozenRender ? "frozen" : "live",
      ].join("|"),
    [placed],
  );

  const strandStageStyle = {
    width: strandSize,
    height: twinning ? strandSize + MATCHING_PAIR_CHROME_HEIGHT_PX : strandSize,
    minWidth: strandSize,
    minHeight: twinning ? strandSize + MATCHING_PAIR_CHROME_HEIGHT_PX : strandSize,
  };

  const showLoading = isLoading && !placed.usedFrozenRender && !placed.placedBeadsA.length;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/50 bg-muted/10">
      <StrandZoomControls
        zoom={displayZoom}
        panMode={panMode}
        onTogglePan={() => setPanMode((on) => !on)}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onReset={reset}
        className="absolute bottom-3 left-3 z-30"
      />

      {!placed.usedFrozenRender ? (
        <p className="absolute left-3 top-3 z-30 max-w-[min(90%,28rem)] rounded-md bg-background/90 px-2 py-1 text-[11px] text-muted-foreground shadow-sm">
          Legacy order — preview uses today’s catalogue assets when available.
        </p>
      ) : null}

      {showLoading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Loading design…
        </div>
      ) : (
        <div
          ref={containerRef}
          className="relative flex min-h-[min(70vh,640px)] flex-1 flex-col overflow-hidden"
          data-strand-zoom-surface
        >
          <BuilderPreviewFitScope builder="bracelet" className="relative flex min-h-0 flex-1 flex-col">
            <StrandViewport
              viewportRef={viewportRef}
              contentRef={contentRef}
              pan={pan}
              isPanning={isPanning}
              viewScale={viewScale}
              panMode={panMode}
              twinning={twinning}
              matchingPairLayout={matchingPairLayout}
              onPointerDown={onPanPointerDown}
              onPointerMove={onPanPointerMove}
              onPointerUp={onPanPointerUp}
              onPointerCancel={onPanPointerCancel}
            >
              <StrandStage className="shrink-0" style={strandStageStyle}>
                <SortableCircularStrand
                  key={`order-a-${layoutKey}`}
                  layoutKey={layoutKey}
                  placedBeads={placed.placedBeadsA}
                  onBeadsReorder={() => undefined}
                  onSlotClick={() => undefined}
                  onBeadDrop={() => undefined}
                  label={twinning ? BRACELET_COPY.wristTwinA : undefined}
                  wristSize={placed.wristSizeCmA}
                  wristSizeBounds={wristSizeBounds}
                  guideSizeMm={8}
                  libraryDragActive
                  pathStartAngle={undefined}
                  size={layoutCanvasSize}
                  readOnly
                  forceStrandRenderProfile={null}
                />
              </StrandStage>

              {twinning ? (
                <StrandStage className="shrink-0" style={strandStageStyle}>
                  <SortableCircularStrand
                    key={`order-b-${layoutKey}`}
                    layoutKey={`${layoutKey}-b`}
                    placedBeads={placed.placedBeadsB}
                    onBeadsReorder={() => undefined}
                    onSlotClick={() => undefined}
                    onBeadDrop={() => undefined}
                    label={BRACELET_COPY.wristTwinB}
                    wristSize={placed.wristSizeCmB}
                    wristSizeBounds={wristSizeBounds}
                    guideSizeMm={8}
                    libraryDragActive
                    pathStartAngle={undefined}
                    size={layoutCanvasSize}
                    readOnly
                    forceStrandRenderProfile={null}
                  />
                </StrandStage>
              ) : null}
            </StrandViewport>
          </BuilderPreviewFitScope>
        </div>
      )}
    </div>
  );
}

export function OrderBraceletDesignViewer({
  open,
  onOpenChange,
  snapshot,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: OrderSnapshot | null;
}) {
  const bracelet = snapshot?.bracelet ?? null;
  const title = snapshot?.designTitle?.trim() || "Design preview";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[94vh] w-[min(98vw,1200px)] max-w-[min(98vw,1200px)] flex-col gap-3 overflow-hidden p-4 sm:rounded-xl",
          "data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100",
        )}
      >
        <DialogHeader className="shrink-0 space-y-1 pr-8 text-left">
          <DialogTitle>View design</DialogTitle>
          <DialogDescription>
            Read-only preview of the bracelet saved with this order. Zoom and pan only — editing is
            disabled.
          </DialogDescription>
        </DialogHeader>

        {bracelet && bracelet.items.length > 0 ? (
          <OrderBraceletStrandViewer bracelet={bracelet} open={open} />
        ) : (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/60 bg-muted/10 text-sm text-muted-foreground">
            <Package className="h-8 w-8" />
            <p>No bracelet design data on this order.</p>
            {snapshot?.previewThumbnailUrl ? (
              <img
                src={snapshot.previewThumbnailUrl}
                alt={title}
                className="mt-2 max-h-[50vh] w-auto max-w-full object-contain"
              />
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
