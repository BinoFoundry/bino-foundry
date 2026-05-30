import { useRef, useState, useEffect, type RefObject } from "react";
import { ClipboardCopy, Copy, Library, RotateCcw, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import BeadLibrary from "@/components/BeadLibrary";
import SortableCircularStrand from "@/components/SortableCircularStrand";
import {
  BraceletSummaryPanel,
  BRACELET_COPY,
  StrandStage,
  StrandViewport,
  StrandZoomControls,
  useBraceletBuilder,
  useBraceletPricingRules,
  useStrandZoom,
} from "@/features/bracelet";
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
      const w = rect.width;
      const h = rect.height;
      const summaryOffset = !isMobile ? 320 : 0;

      if (isMobile) {
        if (twinning) {
          setStrandSize(Math.max(150, Math.min(220, (w - 24) / 2, h - 140)));
        } else {
          setStrandSize(Math.max(200, Math.min(340, w - 32, h - 120)));
        }
      } else {
        const sidebarOffset = libraryOpen ? 260 : 0;
        const availableW = w - sidebarOffset - summaryOffset - 48;
        const strandCount = twinning ? 2 : 1;
        const maxByWidth = (availableW - (twinning ? 32 : 0)) / strandCount;
        setStrandSize(Math.max(260, Math.min(440, maxByWidth, h - 48)));
      }
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

  const { rules: pricingRules } = useBraceletPricingRules();
  const builder = useBraceletBuilder({ onPriceChange, pricingRules });
  const { containerRef, strandSize } = useCanvasSize(isMobile, builder.twinning, libraryOpen);
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
      containerRef: containerRef as RefObject<HTMLElement | null>,
      viewportRef: viewportRef as RefObject<HTMLElement | null>,
      contentRef: contentRef as RefObject<HTMLElement | null>,
    },
    { strandSize, twinning: builder.twinning },
  );
  const strandRenderSize = Math.round(strandSize * zoomSmooth);

  const layoutKey = `${builder.layoutRevision}-${builder.beadCountA}-${builder.beadCountB}-${builder.defaultBeadSize}-${builder.wristSizeA}-${builder.wristSizeB}`;

  const handleSlotClick = (bracelet: "A" | "B", position: number, size: number) => {
    const result = builder.handleSlotClick(bracelet, position);
    if (result?.openLibrary) setLibraryOpen(true);
  };

  const handleSaveConfiguration = async () => {
    if (builder.pricing.placedCount === 0) {
      setSaveStatus("Add at least one bead to save your design");
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
        defaultBeadSizeMm: payload.defaultBeadSizeMm,
        status: "saved",
        items: payload.items,
      });
      setSaveStatus(`Design saved · ref ${saved.id}`);
    } catch (err) {
      setSaveStatus(isApiError(err) ? err.message : "Could not save design");
    } finally {
      setSaving(false);
    }
  };

  const sizeOptions = builder.activeBeadSizes.length
    ? builder.activeBeadSizes
    : [{ sizeMm: 8, label: "8 mm", priceMultiplier: 1, id: "", isActive: true }];

  return (
    <div className="relative flex h-full w-full flex-1 flex-col animate-fade-in">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-3">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <label className="font-body text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs">
            {builder.twinning ? BRACELET_COPY.wristTwinA : BRACELET_COPY.wristLabel}
          </label>
          <input
            type="number"
            value={builder.wristSizeA}
            onChange={(e) => builder.setWristA(Number(e.target.value))}
            className="w-14 rounded-md border border-border bg-background px-2 py-1 font-body text-sm focus:outline-none focus:ring-1 focus:ring-primary sm:w-16"
            min={14}
            max={20}
            step={0.5}
            aria-label={BRACELET_COPY.wristLabel}
          />
          <span className="text-[10px] text-muted-foreground sm:text-xs">cm</span>
          <span className="hidden text-[10px] text-muted-foreground sm:inline">
            · {builder.beadCountA} spaces
          </span>
        </div>

        {builder.twinning ? (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <label className="font-body text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs">
              {BRACELET_COPY.wristTwinB}
            </label>
            <input
              type="number"
              value={builder.wristSizeB}
              onChange={(e) => builder.setWristB(Number(e.target.value))}
              className="w-14 rounded-md border border-border bg-background px-2 py-1 font-body text-sm focus:outline-none focus:ring-1 focus:ring-primary sm:w-16"
              min={14}
              max={20}
              step={0.5}
            />
            <span className="text-[10px] text-muted-foreground sm:text-xs">cm</span>
            <span className="hidden text-[10px] text-muted-foreground sm:inline">
              · {builder.beadCountB} spaces
            </span>
          </div>
        ) : null}

        <div className="flex items-center gap-1.5 sm:gap-2">
          <label className="hidden font-body text-[10px] uppercase tracking-wider text-muted-foreground sm:inline">
            {BRACELET_COPY.beadSizeLabel}
          </label>
          <div className="flex overflow-hidden rounded-md border border-border">
            {sizeOptions.map((s) => (
              <button
                key={s.id || s.sizeMm}
                type="button"
                onClick={() => builder.setDefaultBeadSize(s.sizeMm)}
                className={`px-2.5 py-1 font-body text-xs transition-colors sm:px-3 ${
                  builder.defaultBeadSize === s.sizeMm
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <Button variant="luxe-outline" size="sm" className="text-xs" onClick={() => setLibraryOpen(!libraryOpen)}>
            <Library className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{BRACELET_COPY.library}</span>
          </Button>
          <Button variant="luxe-outline" size="sm" className="text-xs" onClick={builder.handleToggleTwinning}>
            <Copy className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {builder.twinning ? "Single bracelet" : BRACELET_COPY.twinOff}
            </span>
          </Button>
          {builder.twinning ? (
            <Button
              variant="luxe-outline"
              size="sm"
              className="text-xs"
              title={BRACELET_COPY.duplicateToPairHint}
              disabled={builder.placedBeadsA.length === 0}
              onClick={builder.handleDuplicateBraceletToB}
            >
              <ClipboardCopy className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{BRACELET_COPY.duplicateToPair}</span>
            </Button>
          ) : null}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={builder.handleReset} title={BRACELET_COPY.reset}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div
          ref={containerRef}
          className={`relative flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-5 ${
            libraryOpen && !isMobile ? "lg:pl-[260px]" : ""
          }`}
        >
          <BeadLibrary
            open={libraryOpen}
            onSelectBead={(bead) => {
              builder.handleSelectBead(bead);
              if (isMobile) setLibraryOpen(false);
            }}
            onClose={() => setLibraryOpen(false)}
          />

          <StrandZoomControls
            zoom={zoom}
            panMode={panMode}
            canPan={canPan}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onReset={reset}
            onTogglePanMode={togglePanMode}
            className={`absolute bottom-3 z-30 sm:bottom-4 ${
              libraryOpen && !isMobile ? "left-[268px] sm:left-[276px]" : "left-3 sm:left-4"
            }`}
          />

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
                beadCount={builder.beadCountA}
                placedBeads={builder.placedBeadsA}
                onBeadsReorder={(beads) => builder.handleBeadsReorder("A", beads)}
                onSlotClick={(pos, size) => handleSlotClick("A", pos, size)}
                onBeadDrop={(pos, bead) => builder.handleBeadDrop("A", pos, bead)}
                onBeadRemove={(pos) => builder.handleRemoveBead("A", pos)}
                label={builder.twinning ? BRACELET_COPY.wristTwinA : undefined}
                wristSize={builder.wristSizeA}
                defaultBeadSizeMm={builder.defaultBeadSize}
                size={strandRenderSize}
              />
            </StrandStage>

            {builder.twinning ? (
              <StrandStage className="shrink-0">
                <SortableCircularStrand
                  key={`b-${layoutKey}`}
                  layoutKey={layoutKey}
                  beadCount={builder.beadCountB}
                  placedBeads={builder.placedBeadsB}
                  onBeadsReorder={(beads) => builder.handleBeadsReorder("B", beads)}
                  onSlotClick={(pos, size) => handleSlotClick("B", pos, size)}
                  onBeadDrop={(pos, bead) => builder.handleBeadDrop("B", pos, bead)}
                  onBeadRemove={(pos) => builder.handleRemoveBead("B", pos)}
                  label={BRACELET_COPY.wristTwinB}
                  wristSize={builder.wristSizeB}
                  defaultBeadSizeMm={builder.defaultBeadSize}
                  size={strandRenderSize}
                />
              </StrandStage>
            ) : null}
          </StrandViewport>
        </div>

        <div className="hidden shrink-0 lg:flex">
          <BraceletSummaryPanel summary={builder.summary} />
        </div>
      </div>

      <BraceletSummaryPanel summary={builder.summary} collapsible className="lg:hidden" />

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 font-body text-[10px] text-muted-foreground sm:px-6 sm:py-3 sm:text-xs">
        <span>{builder.summary.configSummary}</span>
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
