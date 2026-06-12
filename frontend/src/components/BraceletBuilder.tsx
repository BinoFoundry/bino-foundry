import { useRef, useState, useEffect, useMemo, useCallback, type RefObject } from "react";
import { useSearchParams } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { BraceletConfigPanel } from "@/features/bracelet/components/BraceletConfigPanel";
import { BraceletMobileConfigBar } from "@/features/bracelet/components/BraceletMobileConfigBar";
import type { SelectedBeadRow } from "@/features/bracelet/components/SelectedBeadsList";
import { resolveStrandRingLayout } from "@/features/bracelet/strand-ring-geometry";
import {
  computeLayoutCanvasSize,
  computeStrandAutoFitScale,
  measureStrandCanvasSize,
} from "@/features/bracelet/strand-viewport";
import { BraceletBuilderLayout } from "@/layouts/BraceletBuilderLayout";
import { CUSTOMER_COPY } from "@/lib/customer-copy";
import { getBeadDisplayImageUrl, getStrandBeadImageStyle } from "@/render/bead-crop";
import { useIsMobile } from "@/hooks/use-mobile";
import { setPendingDesignListener } from "@/features/designs/pending-design";
import { captureBraceletThumbnail } from "@/features/designs/capture-thumbnail";
import { CheckoutDialog } from "@/features/account/components/CheckoutDialog";
import { designsApi } from "@/services/api/designs";
import { isApiError } from "@/services/api/errors";
import { useAuth } from "@/state/auth/AuthProvider";
import { useCatalogue } from "@/state/catalogue";
import type { LibraryDragPayload } from "@/components/BeadLibrary";

interface BraceletBuilderProps {
  onPriceChange: (price: number) => void;
}

function useCanvasSize(isMobile: boolean, twinning: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [strandSize, setStrandSize] = useState(400);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const measure = () => {
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
    };

    measure();
    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isMobile, twinning]);

  return { containerRef, strandSize, containerSize };
}

function buildStrandBeadRows(
  placed: ReturnType<typeof useBraceletBuilder>["placedBeadsA"],
  strand: "A" | "B",
  onRemoveOffer: (strand: "A" | "B", offerKey: string) => void,
): SelectedBeadRow[] {
  const counts = new Map<string, { name: string; quantity: number }>();

  for (const p of placed) {
    const key = p.size.offerKey;
    const existing = counts.get(key);
    if (existing) existing.quantity += 1;
    else counts.set(key, { name: p.bead.name, quantity: 1 });
  }

  return [...counts.entries()].map(([offerKey, { name, quantity }]) => ({
    key: `${strand}-${offerKey}`,
    name,
    quantity,
    onRemove: () => onRemoveOffer(strand, offerKey),
  }));
}

const BraceletBuilder = ({ onPriceChange }: BraceletBuilderProps) => {
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const designIdFromUrl = searchParams.get("design");
  const { user, saveDesign, openAuth } = useAuth();
  const catalogue = useCatalogue();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [savedDesignId, setSavedDesignId] = useState<string | null>(designIdFromUrl);
  const hydratedDesignRef = useRef<string | null>(null);
  const [hoverA, setHoverA] = useState<StrandDropHover>(null);
  const [hoverB, setHoverB] = useState<StrandDropHover>(null);
  const [libraryDragActive, setLibraryDragActive] = useState(false);
  const [libraryDragPreview, setLibraryDragPreview] = useState<LibraryDragPayload | null>(null);
  const [panMode, setPanMode] = useState(false);

  const builder = useBraceletBuilder({ onPriceChange });

  useEffect(() => {
    setPendingDesignListener((result) => {
      if (result?.productType === "bracelet") {
        setSavedDesignId(result.id);
        setSaveStatus(CUSTOMER_COPY.saveDesignSuccess(result.id));
      }
    });
    return () => setPendingDesignListener(null);
  }, []);

  useEffect(() => {
    if (designIdFromUrl) setSavedDesignId(designIdFromUrl);
  }, [designIdFromUrl]);

  useEffect(() => {
    if (!designIdFromUrl || !user) return;
    if (hydratedDesignRef.current === designIdFromUrl) return;
    if (catalogue.isHydrating && catalogue.beadLibraries.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const detail = await designsApi.get(designIdFromUrl);
        if (cancelled || detail.productType !== "bracelet" || !detail.bracelet) return;
        builder.loadFromSaved({
          twinning: detail.bracelet.twinning,
          wristSizeCmA: detail.bracelet.wristSizeCmA,
          wristSizeCmB: detail.bracelet.wristSizeCmB,
          items: detail.bracelet.items,
        });
        setSavedDesignId(detail.id);
        hydratedDesignRef.current = designIdFromUrl;
        setSaveStatus(CUSTOMER_COPY.saveDesignSuccess(detail.id));
      } catch (err) {
        if (!cancelled) {
          setSaveStatus(isApiError(err) ? err.message : CUSTOMER_COPY.saveDesignFailed);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    designIdFromUrl,
    user,
    catalogue.isHydrating,
    catalogue.beadLibraries.length,
    builder.loadFromSaved,
  ]);

  const wristConfirmed = builder.wristSizeConfirmed;
  const { containerRef, strandSize, containerSize } = useCanvasSize(isMobile, builder.twinning);
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
    () =>
      computeStrandAutoFitScale(strandSize, layoutCanvasSize, {
        twinning: builder.twinning,
        viewportWidthPx: containerSize.width,
      }),
    [strandSize, layoutCanvasSize, builder.twinning, containerSize.width],
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

  const handleRemoveBeadOffer = useCallback(
    (strand: "A" | "B", offerKey: string) => {
      const placed = strand === "A" ? builder.placedBeadsA : builder.placedBeadsB;
      for (const p of placed) {
        if (p.size.offerKey === offerKey) {
          builder.handleRemoveBead(strand, p.position);
          return;
        }
      }
    },
    [builder.placedBeadsA, builder.placedBeadsB, builder.handleRemoveBead],
  );

  const mainBeadRows = useMemo(
    () => buildStrandBeadRows(builder.placedBeadsA, "A", handleRemoveBeadOffer),
    [builder.placedBeadsA, handleRemoveBeadOffer],
  );

  const matchingPairBeadRows = useMemo(
    () => buildStrandBeadRows(builder.placedBeadsB, "B", handleRemoveBeadOffer),
    [builder.placedBeadsB, handleRemoveBeadOffer],
  );

  const builderActions = {
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
      const previewThumbnailDataUrl =
        (await captureBraceletThumbnail(builder.placedBeadsA, builder.wristSizeA)) ?? undefined;
      const saved = await saveDesign(
        {
          productType: "bracelet",
          title: "Bracelet design",
          status: "saved",
          previewThumbnailDataUrl,
          bracelet: {
            twinning: payload.twinning,
            wristSizeCmA: payload.wristSizeCmA,
            wristSizeCmB: payload.wristSizeCmB,
            items: payload.items,
          },
        },
        { designId: savedDesignId ?? undefined },
      );
      if (saved) {
        setSavedDesignId(saved.id);
        setSaveStatus(CUSTOMER_COPY.saveDesignSuccess(saved.id));
      }
      return saved;
    } catch (err) {
      setSaveStatus(isApiError(err) ? err.message : CUSTOMER_COPY.saveDesignFailed);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleAddToCart = useCallback(async () => {
    if (!user) {
      openAuth({ mode: "sign-in" });
      return;
    }
    if (builder.pricing.placedCount === 0) {
      toast.error(CUSTOMER_COPY.saveDesignNeedBeads);
      return;
    }
    if (builder.isOverCapacity) {
      toast.error(BRACELET_COPY.saveBlockedOverCapacity);
      return;
    }

    let designId = savedDesignId;
    if (!designId) {
      const saved = await handleSaveConfiguration();
      designId = saved?.id ?? null;
    }
    if (!designId) return;
    setCheckoutOpen(true);
  }, [
    user,
    openAuth,
    builder.pricing.placedCount,
    builder.isOverCapacity,
    savedDesignId,
    handleSaveConfiguration,
  ]);

  const saveDisabled = saving || builder.pricing.placedCount === 0 || builder.isOverCapacity;

  const summaryPanelProps = {
    summary: builder.summary,
    mainBeadRows,
    matchingPairBeadRows,
    visualLayoutA,
    visualLayoutB,
    onSave: () => void handleSaveConfiguration(),
    onAddToCart: () => void handleAddToCart(),
    saving,
    saveStatus,
    saveDisabled,
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

  const canvasPanel = (
    <div
      ref={containerRef}
      className="surface-canvas relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
    >
      {isMobile ? (
        <BraceletMobileConfigBar
          wristSizeCm={builder.wristSizeA}
          wristSizeCmB={builder.twinning ? builder.wristSizeB : undefined}
          twinning={builder.twinning}
          wristSizes={builder.wristSizes}
          wristSizeIdA={builder.wristSizeIdA}
          wristSizeIdB={builder.wristSizeIdB}
          onSelectWristA={builder.setWristA}
          onSelectWristB={builder.setWristB}
          onOpenLibrary={() => setLibraryOpen(true)}
        />
      ) : null}

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden p-0.5 sm:p-1">
      {isMobile && libraryOpen ? (
        <BraceletConfigPanel
          embedded={false}
          libraryOpen={libraryOpen}
          onCloseLibrary={() => setLibraryOpen(false)}
          wristSizeCm={builder.wristSizeA}
          wristSizeCmB={builder.twinning ? builder.wristSizeB : undefined}
          twinning={builder.twinning}
          wristSizes={builder.wristSizes}
          wristSizeIdA={builder.wristSizeIdA}
          wristSizeIdB={builder.wristSizeIdB}
          onSelectWristA={builder.setWristA}
          onSelectWristB={builder.setWristB}
          onSelectBead={(bead, variant) => {
            builder.handleSelectBead(bead, variant);
            setLibraryOpen(false);
          }}
          onLibraryDragActiveChange={setLibraryDragActive}
            onLibraryDragChange={(active, payload) => {
              setLibraryDragActive(active);
              setLibraryDragPreview(active ? (payload ?? null) : null);
            }}
            builderActions={builderActions}
          />
      ) : null}

      {builder.selectedBead && isMobile ? (
        <div className="absolute left-3 right-3 top-12 z-30 flex items-center gap-2 rounded-lg border border-border/50 bg-background/90 px-3 py-2 backdrop-blur-sm">
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

      <div className="pointer-events-none absolute inset-x-0 top-2 z-20 flex flex-col items-center gap-1 px-3 sm:top-3">
        {builder.twinning ? (
          <span className="rounded-full border border-primary/25 bg-background/90 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-foreground shadow-sm backdrop-blur-sm">
            {BRACELET_COPY.matchingPairTitle} · {BRACELET_COPY.matchingPairPreviewHint}
          </span>
        ) : null}
      </div>

      <div className="pointer-events-none absolute left-3 right-3 top-2 z-30 flex flex-col gap-2 sm:left-auto sm:right-4 sm:max-w-sm sm:top-12">
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
        className="absolute bottom-3 left-3 z-30 sm:bottom-4 sm:left-4"
      />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute bottom-3 right-3 z-30 h-10 w-10 border border-border/50 bg-background/85 backdrop-blur-sm hover:bg-destructive/10 hover:text-destructive sm:bottom-4 sm:right-4 sm:h-9 sm:w-9"
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
          twinning={builder.twinning}
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
    </div>
  );

  return (
    <>
    <BraceletBuilderLayout
      className="animate-fade-in"
      leftPanel={
        !isMobile ? (
          <BraceletConfigPanel
            embedded
            wristSizeCm={builder.wristSizeA}
            wristSizeCmB={builder.twinning ? builder.wristSizeB : undefined}
            twinning={builder.twinning}
            wristSizes={builder.wristSizes}
            wristSizeIdA={builder.wristSizeIdA}
            wristSizeIdB={builder.wristSizeIdB}
            onSelectWristA={builder.setWristA}
            onSelectWristB={builder.setWristB}
            onSelectBead={builder.handleSelectBead}
            onLibraryDragActiveChange={setLibraryDragActive}
            onLibraryDragChange={(active, payload) => {
              setLibraryDragActive(active);
              setLibraryDragPreview(active ? (payload ?? null) : null);
            }}
            builderActions={builderActions}
          />
        ) : undefined
      }
      centerPanel={canvasPanel}
      rightPanel={<BraceletSummaryPanel {...summaryPanelProps} embedded />}
      mobileFooter={<BraceletSummaryPanel {...summaryPanelProps} collapsible />}
    />
    <CheckoutDialog
      open={checkoutOpen}
      onOpenChange={setCheckoutOpen}
      designId={savedDesignId}
      productLabel="Custom bracelet"
      totalAmount={builder.pricing.total}
      currencyCode={builder.currencyCode}
      defaultEmail={user?.email}
      defaultName={user?.displayName}
    />
    </>
  );
};

export default BraceletBuilder;
