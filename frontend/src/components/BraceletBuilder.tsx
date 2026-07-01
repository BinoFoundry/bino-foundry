import { useRef, useState, useEffect, useMemo, useCallback, type RefObject } from "react";
import { useSearchParams } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { BuilderPreviewFitScope } from "@/features/builder/components/BuilderPreviewFitScope";
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
  computeDefaultStrandZoom,
  CapacityAlertBanner,
  WristSizeStep,
} from "@/features/bracelet";
import { BraceletConfigPanel } from "@/features/bracelet/components/BraceletConfigPanel";
import { BraceletDragOnboardingHint } from "@/features/bracelet/components/BraceletDragOnboardingHint";
import { BraceletNameField } from "@/features/bracelet/components/BraceletNameField";
import { BraceletMobileConfigBar } from "@/features/bracelet/components/BraceletMobileConfigBar";
import { useBraceletDragOnboarding } from "@/features/bracelet/hooks/useBraceletDragOnboarding";
import { resolveBraceletSaveTitle, formatDesignDisplayTitle } from "@/features/designs/display-title";
import {
  fingerprintBraceletPayload,
  fingerprintBraceletVisual,
} from "@/features/designs/design-save-fingerprint";
import { useDesignAutoSave } from "@/features/designs/useDesignAutoSave";
import {
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

const BraceletBuilder = ({ onPriceChange }: BraceletBuilderProps) => {
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const designIdFromUrl = searchParams.get("design");
  const { user, saveDesign, openAuth } = useAuth();
  const catalogue = useCatalogue();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [savedDesignId, setSavedDesignId] = useState<string | null>(designIdFromUrl);
  const [hydrationDone, setHydrationDone] = useState(!designIdFromUrl);
  const baselineSetRef = useRef(false);
  const hydratedDesignRef = useRef<string | null>(null);
  const [hoverA, setHoverA] = useState<StrandDropHover>(null);
  const [hoverB, setHoverB] = useState<StrandDropHover>(null);
  const [libraryDragActive, setLibraryDragActive] = useState(false);
  const [libraryDragPreview, setLibraryDragPreview] = useState<LibraryDragPayload | null>(null);
  const [panMode, setPanMode] = useState(false);
  const [braceletName, setBraceletName] = useState("");

  const builder = useBraceletBuilder({ onPriceChange });

  const dragOnboarding = useBraceletDragOnboarding({
    enabled: builder.wristSizeConfirmed && hydrationDone,
    placedCount: builder.pricing.placedCount,
  });

  const autoSaveEnabled =
    Boolean(user) &&
    builder.wristSizeConfirmed &&
    builder.pricing.placedCount > 0 &&
    !builder.isOverCapacity;

  const autoSavePaused = Boolean(designIdFromUrl && user && !hydrationDone);

  const braceletPayload = useMemo(() => {
    if (!autoSaveEnabled) return null;
    return builder.toSavedPayload("saved");
  }, [
    autoSaveEnabled,
    builder.placedBeadsA,
    builder.placedBeadsB,
    builder.twinning,
    builder.wristSizeA,
    builder.wristSizeB,
    builder.pricing,
  ]);

  const getBraceletFingerprint = useCallback(() => {
    if (!braceletPayload) return null;
    return fingerprintBraceletPayload(braceletPayload, braceletName);
  }, [braceletPayload, braceletName]);

  const getBraceletVisualFingerprint = useCallback(() => {
    if (!braceletPayload) return null;
    return fingerprintBraceletVisual(braceletPayload);
  }, [braceletPayload]);

  const buildBraceletRequest = useCallback(
    async (ctx: { includeThumbnail: boolean }) => {
      if (!braceletPayload) return null;
      let previewThumbnailDataUrl: string | undefined;
      if (ctx.includeThumbnail) {
        previewThumbnailDataUrl =
          (await captureBraceletThumbnail(builder.placedBeadsA, builder.wristSizeA)) ?? undefined;
      }
      return {
        productType: "bracelet" as const,
        title: resolveBraceletSaveTitle(braceletName),
        status: "saved" as const,
        previewThumbnailDataUrl,
        bracelet: {
          twinning: braceletPayload.twinning,
          wristSizeCmA: braceletPayload.wristSizeCmA,
          wristSizeCmB: braceletPayload.wristSizeCmB,
          items: braceletPayload.items,
        },
      };
    },
    [braceletPayload, braceletName, builder.placedBeadsA, builder.wristSizeA],
  );

  const handleDesignSaved = useCallback(
    (saved: { id: string; title?: string | null }) => {
      setSavedDesignId(saved.id);
      if (saved.title?.trim()) setBraceletName(saved.title.trim());
      if (!designIdFromUrl) {
        setSearchParams({ design: saved.id }, { replace: true });
      }
    },
    [designIdFromUrl, setSearchParams],
  );

  const { status: autoSaveStatus, setBaseline, flush, hasPendingChanges } = useDesignAutoSave({
    enabled: autoSaveEnabled,
    paused: autoSavePaused,
    designId: savedDesignId,
    saveDesign,
    onSaved: handleDesignSaved,
    getFingerprint: getBraceletFingerprint,
    getVisualFingerprint: getBraceletVisualFingerprint,
    buildRequest: buildBraceletRequest,
  });

  useEffect(() => {
    if (!hydrationDone || baselineSetRef.current || !braceletPayload) return;
    const fp = fingerprintBraceletPayload(braceletPayload, braceletName);
    const visual = fingerprintBraceletVisual(braceletPayload);
    setBaseline(fp, visual);
    baselineSetRef.current = true;
  }, [hydrationDone, braceletPayload, braceletName, setBaseline]);

  useEffect(() => {
    setPendingDesignListener((result) => {
      if (result?.productType === "bracelet") {
        handleDesignSaved(result);
        if (braceletPayload) {
          setBaseline(
            fingerprintBraceletPayload(braceletPayload, result.title ?? braceletName),
            fingerprintBraceletVisual(braceletPayload),
          );
        }
      }
    });
    return () => setPendingDesignListener(null);
  }, [handleDesignSaved, braceletPayload, braceletName, setBaseline]);

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
        setBraceletName(detail.title?.trim() ?? "");
        setSavedDesignId(detail.id);
        hydratedDesignRef.current = designIdFromUrl;
        setHydrationDone(true);
      } catch (err) {
        if (!cancelled) {
          setHydrationDone(true);
          toast.error(isApiError(err) ? err.message : CUSTOMER_COPY.saveDesignFailed);
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

  /** Fixed workspace — sized from container only, never from bead count or ring expansion. */
  const layoutCanvasSize = strandSize;

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

  const defaultStrandZoom = useMemo(
    () =>
      computeDefaultStrandZoom({
        twinning: builder.twinning,
        containerWidth: containerSize.width,
        containerHeight: containerSize.height,
        isMobile,
        autoFitScale,
      }),
    [
      builder.twinning,
      containerSize.width,
      containerSize.height,
      isMobile,
      autoFitScale,
    ],
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
    defaultStrandZoom,
    { suspendPan: libraryDragActive, panMode, defaultZoom: defaultStrandZoom },
  );

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
    twinning: builder.twinning,
    onToggleTwinning: builder.handleToggleTwinning,
    onDuplicateToB: builder.handleDuplicateBraceletToB,
    duplicateDisabled: builder.placedBeadsA.length === 0 || !builder.canDuplicateToB,
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
    if (!designId || hasPendingChanges()) {
      const saved = await flush();
      designId = saved?.id ?? savedDesignId;
    }
    if (!designId) return;
    setCheckoutOpen(true);
  }, [
    user,
    openAuth,
    builder.pricing.placedCount,
    builder.isOverCapacity,
    savedDesignId,
    flush,
    hasPendingChanges,
  ]);

  const saveDisabled = builder.pricing.placedCount === 0 || builder.isOverCapacity;

  const summaryPanelProps = {
    summary: builder.summary,
    onAddToCart: () => void handleAddToCart(),
    saveDisabled,
    autoSaveStatus,
    autoSaveVisible: builder.wristSizeConfirmed,
    signedIn: Boolean(user),
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
            braceletName={braceletName}
            onBraceletNameChange={setBraceletName}
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
        onShowTips={dragOnboarding.replayTips}
        className="absolute bottom-3 left-3 z-30 sm:bottom-4 sm:left-4"
      />

      <BraceletDragOnboardingHint
        active={dragOnboarding.hintActive}
        visible={dragOnboarding.hintVisible}
        onDismiss={dragOnboarding.dismissHint}
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
        <BuilderPreviewFitScope builder="bracelet" className="relative flex min-h-0 flex-1 flex-col">
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
          <StrandStage className="shrink-0" style={{ width: strandSize, height: strandSize, minWidth: strandSize, minHeight: strandSize }}>
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
            <StrandStage className="shrink-0" style={{ width: strandSize, height: strandSize, minWidth: strandSize, minHeight: strandSize }}>
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
        </BuilderPreviewFitScope>
      </div>
      </div>
    </div>
  );

  return (
    <>
    <BraceletBuilderLayout
      className="animate-fade-in"
      leftPanelHeader={
        <BraceletNameField id="bracelet-name" value={braceletName} onChange={setBraceletName} />
      }
      leftPanelLabel={braceletName.trim() || BRACELET_COPY.braceletNameLabel}
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
      productLabel={
        braceletName.trim()
          ? braceletName.trim()
          : formatDesignDisplayTitle({ title: null, productType: "bracelet" })
      }
      totalAmount={builder.pricing.total}
      currencyCode={builder.currencyCode}
      defaultEmail={user?.email}
      defaultName={user?.displayName}
    />
    </>
  );
};

export default BraceletBuilder;
