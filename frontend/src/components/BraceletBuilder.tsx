import { useRef, useState, useEffect, useMemo, type RefObject } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import BeadLibrary, { type LibraryDragPayload } from "@/components/BeadLibrary";
import SortableCircularStrand, { type StrandDropHover } from "@/components/SortableCircularStrand";
import {
  BraceletSummaryPanel,
  BRACELET_COPY,
  StrandStage,
  StrandViewport,
  StrandZoomControls,
  useBraceletBuilder,
  useStrandZoom,
  CapacityAlertBanner,
  WristSizeStep,
} from "@/features/bracelet";
import { resolveStrandRingLayout } from "@/features/bracelet/strand-ring-geometry";
import {
  computeLayoutCanvasSize,
  computeStrandAutoFitScale,
  measureStrandCanvasSize,
} from "@/features/bracelet/strand-viewport";
import { CUSTOMER_COPY } from "@/lib/customer-copy";
import { getBeadDisplayImageUrl, getStrandBeadImageStyle } from "@/render/bead-crop";
import { useIsMobile } from "@/hooks/use-mobile";
import { braceletApi } from "@/services/api/bracelet";
import { isApiError } from "@/services/api/errors";

interface BraceletBuilderProps {
  onPriceChange: (price: number) => void;
}

function useCanvasSize(isMobile: boolean, twinning: boolean, libraryOpen: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [strandSize, setStrandSize] = useState(400);

  useEffect(() => {
    const measure = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setStrandSize(
        measureStrandCanvasSize({
          containerWidth: rect.width,
          containerHeight: rect.height,
          isMobile,
          twinning,
          libraryOpen,
        }),
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isMobile, twinning, libraryOpen]);

  return { containerRef, strandSize };
}

const BraceletBuilder = ({ onPriceChange }: BraceletBuilderProps) => {
  const isMobile = useIsMobile();
  const [libraryOpen, setLibraryOpen] = useState(() => !window.matchMedia("(max-width: 767px)").matches);
  const [saveStatus, setSaveStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [hoverA, setHoverA] = useState<StrandDropHover>(null);
  const [hoverB, setHoverB] = useState<StrandDropHover>(null);
  const [libraryDragActive, setLibraryDragActive] = useState(false);
  const [libraryDragPreview, setLibraryDragPreview] = useState<LibraryDragPayload | null>(null);
  const [panMode, setPanMode] = useState(false);

  const builder = useBraceletBuilder({ onPriceChange });
  const wristConfirmed = builder.wristSizeConfirmed;
  const { containerRef, strandSize } = useCanvasSize(isMobile, builder.twinning, wristConfirmed && libraryOpen);
  const canvasZoomRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const layoutKey = [
    builder.layoutRevision,
    builder.wristSizeA,
    builder.wristSizeB,
    builder.placedBeadsA.map((b) => `${b.position}:${b.size.offerKey}`).join(","),
    builder.placedBeadsB.map((b) => `${b.position}:${b.size.offerKey}`).join(","),
  ].join("|");

  const guideMm = builder.activeSizeOffer?.sizeMm ?? 8;

  const layoutCanvasSize = useMemo(() => {
    const sizeA = computeLayoutCanvasSize({
      placed: builder.placedBeadsA,
      wristSizeCm: builder.wristSizeA,
      wristSizeBounds: builder.wristSizeBounds,
      viewportBudgetPx: strandSize,
      guideSizeMm: guideMm,
    });
    if (!builder.twinning) return sizeA;
    const sizeB = computeLayoutCanvasSize({
      placed: builder.placedBeadsB,
      wristSizeCm: builder.wristSizeB,
      wristSizeBounds: builder.wristSizeBounds,
      viewportBudgetPx: strandSize,
      guideSizeMm: guideMm,
    });
    return Math.max(sizeA, sizeB);
  }, [
    builder.placedBeadsA,
    builder.placedBeadsB,
    builder.twinning,
    builder.wristSizeA,
    builder.wristSizeB,
    builder.wristSizeBounds,
    builder.layoutRevision,
    strandSize,
    guideMm,
  ]);

  const autoFitScale = useMemo(
    () => computeStrandAutoFitScale(strandSize, layoutCanvasSize),
    [strandSize, layoutCanvasSize],
  );

  const strandZoomLayout = useMemo(
    () => ({
      viewportSize: strandSize,
      layoutCanvasSize,
      autoFitScale,
      twinning: builder.twinning,
    }),
    [strandSize, layoutCanvasSize, autoFitScale, builder.twinning],
  );

  const {
    zoom,
    viewScale,
    pan,
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
      zoomSurfaceRef: canvasZoomRef as RefObject<HTMLElement | null>,
      containerRef: canvasZoomRef as RefObject<HTMLElement | null>,
      viewportRef: viewportRef as RefObject<HTMLElement | null>,
      contentRef: contentRef as RefObject<HTMLElement | null>,
    },
    strandZoomLayout,
    1,
    { suspendPan: libraryDragActive, panMode },
  );

  const visualLayoutA = useMemo(() => {
    const layout = resolveStrandRingLayout({
      placed: builder.placedBeadsA,
      wristSizeCm: builder.wristSizeA,
      wristSizeBounds: builder.wristSizeBounds,
      canvasSize: strandSize,
      guideSizeMm: guideMm,
    });
    if (!layout) return undefined;
    return {
      visuallyExpanded: layout.resolved.expanded,
      visualOverCanvas: layout.resolved.isVisualOverCanvas,
    };
  }, [
    builder.placedBeadsA,
    builder.wristSizeA,
    builder.wristSizeBounds,
    builder.layoutRevision,
    strandSize,
    guideMm,
  ]);

  const visualLayoutB = useMemo(() => {
    if (!builder.twinning) return undefined;
    const layout = resolveStrandRingLayout({
      placed: builder.placedBeadsB,
      wristSizeCm: builder.wristSizeB,
      wristSizeBounds: builder.wristSizeBounds,
      canvasSize: strandSize,
      guideSizeMm: guideMm,
    });
    if (!layout) return undefined;
    return {
      visuallyExpanded: layout.resolved.expanded,
      visualOverCanvas: layout.resolved.isVisualOverCanvas,
    };
  }, [
    builder.twinning,
    builder.placedBeadsB,
    builder.wristSizeB,
    builder.wristSizeBounds,
    builder.layoutRevision,
    strandSize,
    guideMm,
  ]);

  useEffect(() => {
    if (!libraryDragActive) return;
    const onDragEnd = () => {
      setLibraryDragActive(false);
      setLibraryDragPreview(null);
      setHoverA(null);
      setHoverB(null);
    };
    window.addEventListener("dragend", onDragEnd);
    return () => window.removeEventListener("dragend", onDragEnd);
  }, [libraryDragActive]);

  const builderActions = {
    libraryOpen,
    onToggleLibrary: () => setLibraryOpen((open) => !open),
    twinning: builder.twinning,
    onToggleTwinning: builder.handleToggleTwinning,
    onDuplicateToB: builder.handleDuplicateBraceletToB,
    duplicateDisabled: builder.placedBeadsA.length === 0 || !builder.canDuplicateToB,
  };

  const handleSaveConfiguration = async () => {
    if (builder.pricing.placedCount === 0) {
      setSaveStatus(CUSTOMER_COPY.saveDesignNeedBeads);
      return;
    }
    if (builder.isOverCapacity) {
      setSaveStatus(BRACELET_COPY.saveBlockedOverCapacity);
      return;
    }
    setSaving(true);
    setSaveStatus("");
    try {
      const payload = builder.toSavedPayload("saved");
      const saved = await braceletApi.saveConfiguration({
        twinning: payload.twinning,
        wristSizeCmA: payload.wristSizeCmA,
        wristSizeCmB: payload.wristSizeCmB,
        status: "saved",
        items: payload.items,
      });
      setSaveStatus(CUSTOMER_COPY.saveDesignSuccess(saved.id));
    } catch (err) {
      setSaveStatus(isApiError(err) ? err.message : CUSTOMER_COPY.saveDesignFailed);
    } finally {
      setSaving(false);
    }
  };

  if (!wristConfirmed) {
    return (
      <div className="relative flex h-full w-full flex-1 flex-col animate-fade-in bg-gradient-to-b from-background via-background to-muted/20">
        <div className="flex min-h-0 flex-1 items-center justify-center p-6 sm:p-12">
          <WristSizeStep
            sizes={builder.wristSizes}
            selectedId={builder.draftWristIdA}
            onSelect={builder.selectDraftWristA}
            onConfirm={builder.confirmWristSizes}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full flex-1 flex-col animate-fade-in">
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div
          ref={containerRef}
          className={`surface-canvas relative isolate z-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-1 max-sm:pb-[env(safe-area-inset-bottom)] sm:p-1.5 ${
            libraryOpen && !isMobile ? "lg:pl-[256px]" : ""
          }`}
        >
          <BeadLibrary
            open={libraryOpen}
            onLibraryDragActiveChange={setLibraryDragActive}
            onLibraryDragChange={(active, payload) => {
              setLibraryDragActive(active);
              setLibraryDragPreview(active ? (payload ?? null) : null);
            }}
            onSelectBead={(bead, variant) => {
              builder.handleSelectBead(bead, variant);
              if (isMobile) setLibraryOpen(false);
            }}
            onClose={() => setLibraryOpen(false)}
          />

          {builder.selectedBead && isMobile ? (
            <div className="absolute left-3 right-3 top-2 z-30 flex items-center gap-2 rounded-lg border border-primary/25 bg-background/95 px-3 py-2 shadow-sm backdrop-blur-sm">
              {getBeadDisplayImageUrl(builder.selectedBead) ? (
                <img
                  src={getBeadDisplayImageUrl(builder.selectedBead)!}
                  alt=""
                  className="h-8 w-8 shrink-0 object-contain"
                  style={getStrandBeadImageStyle(builder.selectedBead)}
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{builder.selectedBead.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {builder.activeSizeOffer?.label ?? BRACELET_COPY.selectedBeadHint}
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => builder.setSelectedBead(null)}>
                {BRACELET_COPY.clearSelection}
              </Button>
            </div>
          ) : null}

          <div className="pointer-events-none absolute left-3 right-3 top-2 z-30 flex flex-col gap-2 sm:left-auto sm:right-4 sm:max-w-sm">
            {builder.isOverCapacity ? (
              <CapacityAlertBanner
                variant="over"
                message={BRACELET_COPY.overCapacityBanner}
                className="pointer-events-auto"
              />
            ) : null}
            {builder.capacityNotice ? (
              <CapacityAlertBanner
                variant={builder.capacityNoticeVariant}
                message={builder.capacityNotice}
                onDismiss={() => builder.setCapacityNotice(null)}
                className="pointer-events-auto"
              />
            ) : null}
          </div>
          <StrandZoomControls
            zoom={zoom}
            panMode={panMode}
            onTogglePan={() => setPanMode((on) => !on)}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onReset={reset}
            className={`absolute bottom-3 z-30 sm:bottom-4 ${
              libraryOpen && !isMobile ? "left-[264px]" : "left-3 sm:left-4"
            }`}
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute bottom-3 right-3 z-30 h-10 w-10 border border-border/80 bg-background/90 shadow-sm backdrop-blur-sm hover:bg-destructive/10 hover:text-destructive sm:bottom-4 sm:right-4 sm:h-9 sm:w-9"
            title={BRACELET_COPY.clearStrand}
            aria-label={BRACELET_COPY.clearStrand}
            disabled={builder.pricing.placedCount === 0}
            onClick={builder.handleReset}
          >
            <Trash2 className="h-4 w-4" />
          </Button>

          <div
            ref={canvasZoomRef}
            className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden"
            data-strand-zoom-surface
          >
            <StrandViewport
              viewportRef={viewportRef}
              contentRef={contentRef}
              pan={pan}
              isPanning={isPanning}
              viewScale={viewScale}
              panMode={panMode}
              onPointerDown={onPanPointerDown}
              onPointerMove={onPanPointerMove}
              onPointerUp={onPanPointerUp}
              onPointerCancel={onPanPointerCancel}
            >
              <StrandStage className="shrink-0">
                <SortableCircularStrand
                  key={`a-${layoutKey}`}
                  layoutKey={layoutKey}
                  placedBeads={builder.placedBeadsA}
                  onBeadsReorder={(from, to) => builder.handleBeadsReorder("A", from, to)}
                  onSlotClick={(pos) => {
                    const result = builder.handleSlotClick("A", pos);
                    if (result?.openLibrary) setLibraryOpen(true);
                  }}
                  onBeadDrop={(target, data) => builder.handleBeadDrop("A", target, data)}
                  onBeadRemove={(pos) => builder.handleRemoveBead("A", pos)}
                  label={builder.twinning ? BRACELET_COPY.wristTwinA : undefined}
                  wristSize={builder.wristSizeA}
                  wristSizeBounds={builder.wristSizeBounds}
                  guideSizeMm={guideMm}
                  hoverDropTarget={hoverA}
                  onHoverDropTarget={setHoverA}
                  selectedPosition={
                    builder.selectedStrandBead?.bracelet === "A" ? builder.selectedStrandBead.position : null
                  }
                  libraryDragActive={libraryDragActive}
                  libraryDragPreview={libraryDragPreview}
                  pathStartAngle={builder.strandAnchorAngleA}
                  size={layoutCanvasSize}
                />
              </StrandStage>

              {builder.twinning ? (
                <StrandStage className="shrink-0">
                  <SortableCircularStrand
                    key={`b-${layoutKey}`}
                    layoutKey={layoutKey}
                    placedBeads={builder.placedBeadsB}
                    onBeadsReorder={(from, to) => builder.handleBeadsReorder("B", from, to)}
                    onSlotClick={(pos) => {
                      const result = builder.handleSlotClick("B", pos);
                      if (result?.openLibrary) setLibraryOpen(true);
                    }}
                    onBeadDrop={(target, data) => builder.handleBeadDrop("B", target, data)}
                    onBeadRemove={(pos) => builder.handleRemoveBead("B", pos)}
                    label={BRACELET_COPY.wristTwinB}
                    wristSize={builder.wristSizeB}
                    wristSizeBounds={builder.wristSizeBounds}
                    guideSizeMm={guideMm}
                    hoverDropTarget={hoverB}
                    onHoverDropTarget={setHoverB}
                    selectedPosition={
                      builder.selectedStrandBead?.bracelet === "B" ? builder.selectedStrandBead.position : null
                    }
                    libraryDragActive={libraryDragActive}
                    libraryDragPreview={libraryDragPreview}
                    pathStartAngle={builder.strandAnchorAngleB}
                    size={layoutCanvasSize}
                  />
                </StrandStage>
              ) : null}
            </StrandViewport>
          </div>
        </div>

        <div className="relative z-10 hidden shrink-0 lg:flex">
          <BraceletSummaryPanel
            summary={builder.summary}
            builderActions={builderActions}
            wristSizes={builder.wristSizes}
            wristSizeIdA={builder.wristSizeIdA}
            wristSizeIdB={builder.wristSizeIdB}
            onSelectWristA={builder.setWristA}
            onSelectWristB={builder.setWristB}
            wristSizeConfirmed={builder.wristSizeConfirmed}
            visualLayoutA={visualLayoutA}
            visualLayoutB={visualLayoutB}
            onSave={() => void handleSaveConfiguration()}
            saving={saving}
            saveStatus={saveStatus}
            saveDisabled={saving || builder.pricing.placedCount === 0 || builder.isOverCapacity}
          />
        </div>
      </div>

      <BraceletSummaryPanel
        summary={builder.summary}
        builderActions={builderActions}
        wristSizes={builder.wristSizes}
        wristSizeIdA={builder.wristSizeIdA}
        wristSizeIdB={builder.wristSizeIdB}
        onSelectWristA={builder.setWristA}
        onSelectWristB={builder.setWristB}
        wristSizeConfirmed={builder.wristSizeConfirmed}
        visualLayoutA={visualLayoutA}
        visualLayoutB={visualLayoutB}
        onSave={() => void handleSaveConfiguration()}
        saving={saving}
        saveStatus={saveStatus}
        saveDisabled={saving || builder.pricing.placedCount === 0 || builder.isOverCapacity}
        collapsible
        className="lg:hidden"
      />
    </div>
  );
};

export default BraceletBuilder;
