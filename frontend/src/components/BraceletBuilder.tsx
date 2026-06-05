import { useRef, useState, useEffect, type RefObject } from "react";
import { Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import BeadLibrary from "@/components/BeadLibrary";
import SortableCircularStrand from "@/components/SortableCircularStrand";
import {
  BraceletSummaryPanel,
  BRACELET_COPY,
  formatWristFitRange,
  StrandStage,
  StrandViewport,
  StrandZoomControls,
  useBraceletBuilder,
  useStrandZoom,
} from "@/features/bracelet";
import { measureStrandCanvasSize } from "@/features/bracelet/strand-viewport";
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
  const [hoverA, setHoverA] = useState<number | null>(null);
  const [hoverB, setHoverB] = useState<number | null>(null);
  const [libraryDragActive, setLibraryDragActive] = useState(false);

  const builder = useBraceletBuilder({ onPriceChange });
  const { containerRef, strandSize } = useCanvasSize(isMobile, builder.twinning, libraryOpen);
  const canvasZoomRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const {
    zoom,
    zoomSmooth,
    pan,
    panMode,
    isPanning,
    canPan,
    zoomIn,
    zoomOut,
    reset,
    togglePanMode,
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
    { strandSize, twinning: builder.twinning },
    1,
    { suspendPan: libraryDragActive },
  );
  const strandRenderSize = Math.round(strandSize * zoomSmooth);

  const layoutKey = `${builder.layoutRevision}-${builder.placedBeadsA.map((b) => `${b.position}:${b.size.offerKey}`).join(",")}-${builder.placedBeadsB.map((b) => `${b.position}:${b.size.offerKey}`).join(",")}`;

  const guideMm = builder.activeSizeOffer?.sizeMm ?? 8;

  useEffect(() => {
    if (!libraryDragActive) return;
    const onDragEnd = () => {
      setLibraryDragActive(false);
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
    duplicateDisabled: builder.placedBeadsA.length === 0,
  };

  const handleSaveConfiguration = async () => {
    if (builder.pricing.placedCount === 0) {
      setSaveStatus(CUSTOMER_COPY.saveDesignNeedBeads);
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

  return (
    <div className="relative flex h-full w-full flex-1 flex-col animate-fade-in">
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div
          ref={containerRef}
          className={`relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5 ${
            libraryOpen && !isMobile ? "lg:pl-[272px]" : ""
          }`}
        >
          <BeadLibrary
            open={libraryOpen}
            onLibraryDragActiveChange={setLibraryDragActive}
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

          <StrandZoomControls
            zoom={zoom}
            panMode={panMode}
            canPan={canPan}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onReset={reset}
            onTogglePanMode={togglePanMode}
            className={`absolute bottom-3 z-30 sm:bottom-4 ${
              libraryOpen && !isMobile ? "left-[280px]" : "left-3 sm:left-4"
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
            className="relative flex min-h-0 w-full flex-1 flex-col"
            data-strand-zoom-surface
          >
          <StrandViewport
            viewportRef={viewportRef}
            contentRef={contentRef}
            pan={pan}
            panMode={panMode}
            isPanning={isPanning}
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
                onBeadDrop={(pos, data) => builder.handleBeadDrop("A", pos, data)}
                onBeadRemove={(pos) => builder.handleRemoveBead("A", pos)}
                label={builder.twinning ? BRACELET_COPY.wristTwinA : undefined}
                wristSize={builder.wristSizeA}
                guideSizeMm={guideMm}
                hoverPosition={hoverA}
                onHoverPosition={setHoverA}
                selectedPosition={
                  builder.selectedStrandBead?.bracelet === "A" ? builder.selectedStrandBead.position : null
                }
                libraryDragActive={libraryDragActive}
                panMode={panMode}
                size={strandRenderSize}
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
                  onBeadDrop={(pos, data) => builder.handleBeadDrop("B", pos, data)}
                  onBeadRemove={(pos) => builder.handleRemoveBead("B", pos)}
                  label={BRACELET_COPY.wristTwinB}
                  wristSize={builder.wristSizeB}
                  guideSizeMm={guideMm}
                  hoverPosition={hoverB}
                  onHoverPosition={setHoverB}
                  selectedPosition={
                    builder.selectedStrandBead?.bracelet === "B" ? builder.selectedStrandBead.position : null
                  }
                  libraryDragActive={libraryDragActive}
                  panMode={panMode}
                  size={strandRenderSize}
                />
              </StrandStage>
            ) : null}
          </StrandViewport>
          </div>
        </div>

        <div className="hidden shrink-0 lg:flex">
          <BraceletSummaryPanel summary={builder.summary} builderActions={builderActions} />
        </div>
      </div>

      <BraceletSummaryPanel
        summary={builder.summary}
        builderActions={builderActions}
        collapsible
        className="lg:hidden"
      />

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 font-body text-[10px] text-muted-foreground sm:px-6 sm:py-3 sm:text-xs">
        <span>
          {builder.summary.twinning && builder.summary.wristFitB ? (
            <>
              {BRACELET_COPY.wristTwinA}: {formatWristFitRange(builder.summary.wristFitA)}
              {builder.summary.wristFitA.beadCount > 0
                ? ` · ${builder.summary.wristFitA.lengthMm} mm`
                : ""}
              {" · "}
              {BRACELET_COPY.wristTwinB}: {formatWristFitRange(builder.summary.wristFitB)}
              {builder.summary.wristFitB.beadCount > 0 ? ` · ${builder.summary.wristFitB.lengthMm} mm` : ""}
            </>
          ) : (
            <>
              {formatWristFitRange(builder.summary.wristFitA)}
              {builder.summary.wristFitA.beadCount > 0
                ? ` · ${builder.summary.wristFitA.lengthMm} mm length`
                : ""}
            </>
          )}
        </span>
        <div className="flex items-center gap-2">
          {saveStatus ? <span className="text-foreground/80">{saveStatus}</span> : null}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={saving || builder.pricing.placedCount === 0}
            onClick={() => void handleSaveConfiguration()}
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {saving ? BRACELET_COPY.saving : BRACELET_COPY.saveConfig}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BraceletBuilder;
