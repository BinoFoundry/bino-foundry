import { useRef, useState, useEffect, useMemo, useCallback, type RefObject } from "react";
import { useSearchParams } from "react-router-dom";
import { Settings2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { BuilderPreviewFitScope } from "@/features/builder/components/BuilderPreviewFitScope";
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
  measureStrandCanvasSize,
  CapacityAlertBanner,
  WristSizeStep,
} from "@/features/bracelet";
import { MATCHING_PAIR_CHROME_HEIGHT_PX } from "@/features/bracelet/strand-camera";
import { BraceletConfigPanel } from "@/features/bracelet/components/BraceletConfigPanel";
import { BraceletDragOnboardingHint } from "@/features/bracelet/components/BraceletDragOnboardingHint";
import { BraceletNameField } from "@/features/bracelet/components/BraceletNameField";
import { BraceletMobileOptionsDrawer } from "@/features/bracelet/components/BraceletMobileOptionsDrawer";
import { BraceletMobileStatusCard } from "@/features/bracelet/components/BraceletMobileStatusCard";
import { BraceletMobileSummaryDrawer } from "@/features/bracelet/components/BraceletMobileSummaryDrawer";
import {
  BraceletMobileStrandSwitcher,
  type BraceletMobileViewMode,
} from "@/features/bracelet/components/BraceletMobileStrandSwitcher";
import { useBraceletDragOnboarding } from "@/features/bracelet/hooks/useBraceletDragOnboarding";
import { resolveBraceletSaveTitle, formatDesignDisplayTitle } from "@/features/designs/display-title";
import {
  fingerprintBraceletPayload,
  fingerprintBraceletVisual,
} from "@/features/designs/design-save-fingerprint";
import { formatDesignSaveError } from "@/features/designs/format-design-save-error";
import { useDesignAutoSave } from "@/features/designs/useDesignAutoSave";
import {
  clearStaleDesignUrl,
  createRecoveringSaveDesign,
} from "@/features/designs/recovering-save-design";
import { BraceletBuilderLayout } from "@/layouts/BraceletBuilderLayout";
import { CUSTOMER_COPY } from "@/lib/customer-copy";
import { getBeadDisplayImageUrl, getBeadLibraryThumbnailStyle } from "@/render/bead-crop";
import { useIsMobile } from "@/hooks/use-mobile";
import { setPendingDesignListener } from "@/features/designs/pending-design";
import { captureBraceletThumbnail } from "@/features/designs/capture-thumbnail";
import { CheckoutDialog } from "@/features/account/components/CheckoutDialog";
import { designsApi } from "@/services/api/designs";
import { isApiError } from "@/services/api/errors";
import { useAuth } from "@/state/auth/AuthProvider";
import { useCatalogue } from "@/state/catalogue";
interface BraceletBuilderProps {
  onPriceChange: (price: number) => void;
}

function useCanvasSize(isMobile: boolean, enabled: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [strandSize, setStrandSize] = useState(400);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const measureLayoutCanvas = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setStrandSize(
      measureStrandCanvasSize({
        containerWidth: rect.width,
        containerHeight: rect.height,
        isMobile,
        twinning: false,
        libraryOpen: false,
      }),
    );
  }, [isMobile]);

  const measureViewport = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setContainerSize({ width: rect.width, height: rect.height });
  }, []);

  useEffect(() => {
    if (!enabled) return;

    measureViewport();
    measureLayoutCanvas();

    const observer = new ResizeObserver(measureViewport);
    const node = containerRef.current;
    if (node) observer.observe(node);

    const onWindowResize = () => {
      measureViewport();
      measureLayoutCanvas();
    };
    window.addEventListener("resize", onWindowResize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onWindowResize);
    };
  }, [enabled, measureViewport, measureLayoutCanvas]);

  return { containerRef, strandSize, containerSize };
}

const BraceletBuilder = ({ onPriceChange }: BraceletBuilderProps) => {
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const designIdFromUrl = searchParams.get("design");
  const { user, saveDesign, openAuth } = useAuth();
  const catalogue = useCatalogue();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [mobileViewMode, setMobileViewMode] = useState<BraceletMobileViewMode>("A");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [savingDesign, setSavingDesign] = useState(false);
  const [savedDesignId, setSavedDesignId] = useState<string | null>(designIdFromUrl);
  const [hydrationDone, setHydrationDone] = useState(!designIdFromUrl);
  const baselineSetRef = useRef(false);
  const hydratedDesignRef = useRef<string | null>(null);
  const [hoverA, setHoverA] = useState<StrandDropHover>(null);
  const [hoverB, setHoverB] = useState<StrandDropHover>(null);
  const [libraryDragActive, setLibraryDragActive] = useState(false);
  const [libraryDragPreview, setLibraryDragPreview] = useState<LibraryDragPayload | null>(null);
  const [strandDragActive, setStrandDragActive] = useState(false);
  const [panMode, setPanMode] = useState(false);
  const [braceletName, setBraceletName] = useState("");

  const builder = useBraceletBuilder({ onPriceChange });

  const showMatchingPairPreview =
    builder.twinning && (!isMobile || mobileViewMode === "mirror");
  const showStrandA = !isMobile || mobileViewMode !== "B";
  const showStrandB = builder.twinning && (!isMobile || mobileViewMode !== "A");

  useEffect(() => {
    if (!builder.twinning && mobileViewMode !== "A") {
      setMobileViewMode("A");
    }
  }, [builder.twinning, mobileViewMode]);

  const handleMobileViewModeChange = useCallback(
    (mode: BraceletMobileViewMode) => {
      if ((mode === "B" || mode === "mirror") && !builder.twinning) {
        builder.handleToggleTwinning();
      }
      setMobileViewMode(mode);
      if (mode === "A" || mode === "B") {
        builder.setActivePlacementStrand(mode);
      }
    },
    [builder.twinning, builder.handleToggleTwinning, builder.setActivePlacementStrand],
  );

  const dragOnboarding = useBraceletDragOnboarding({
    enabled: builder.wristSizeConfirmed && hydrationDone,
    placedCount: builder.pricing.placedCount,
  });

  const canConfigureSave =
    builder.wristSizeConfirmed &&
    builder.pricing.placedCount > 0 &&
    !builder.isOverCapacity &&
    !builder.hasUnavailableBeads;
  // Track dirty state for Stay/Leave; server writes only via explicit Save / checkout flush.
  const draftTrackingEnabled = canConfigureSave;

  const autoSavePaused = Boolean(designIdFromUrl && user && !hydrationDone);

  const braceletPayload = useMemo(() => {
    if (!canConfigureSave) return null;
    return builder.toSavedPayload("saved");
  }, [
    canConfigureSave,
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

  const handleStaleDesignId = useCallback(() => {
    clearStaleDesignUrl(designIdFromUrl, setSavedDesignId, setSearchParams);
  }, [designIdFromUrl, setSearchParams]);

  const saveDesignForAutoSave = useMemo(
    () => createRecoveringSaveDesign(saveDesign, handleStaleDesignId),
    [saveDesign, handleStaleDesignId],
  );

  const wristConfirmed = builder.wristSizeConfirmed;
  const { containerRef, strandSize, containerSize } = useCanvasSize(isMobile, wristConfirmed);
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

  /** Fixed workspace — sized from container on mount/window resize only, never from twin chrome. */
  const layoutCanvasSize = strandSize;

  const strandZoomLayout = useMemo(
    () => ({
      viewportWidthPx: containerSize.width,
      viewportHeightPx: containerSize.height,
      layoutCanvasSize,
      twinning: showMatchingPairPreview,
      // Remeasure painted bounds when wrist or beads change (dangling hang).
      contentKey: layoutKey,
    }),
    [containerSize.width, containerSize.height, layoutCanvasSize, showMatchingPairPreview, layoutKey],
  );

  const layoutReady =
    wristConfirmed &&
    containerSize.width > 0 &&
    containerSize.height > 0 &&
    layoutCanvasSize > 0;

  const {
    zoom,
    displayZoom,
    viewScale,
    pan,
    matchingPairLayout,
    isPanning,
    isZoomAnimating,
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
    { suspendPan: libraryDragActive, panMode, layoutReady },
  );

  const autoSaveInteractionHold =
    libraryDragActive || strandDragActive || isPanning || isZoomAnimating;

  const {
    status: autoSaveStatus,
    setBaseline,
    flush,
    hasPendingChanges,
    clearLocalDraft,
    leaveGuard,
  } = useDesignAutoSave({
    enabled: draftTrackingEnabled,
    paused: autoSavePaused,
    productType: "bracelet",
    designId: savedDesignId,
    saveDesign: saveDesignForAutoSave,
    onSaved: handleDesignSaved,
    getFingerprint: getBraceletFingerprint,
    getVisualFingerprint: getBraceletVisualFingerprint,
    buildRequest: buildBraceletRequest,
    interactionHold: autoSaveInteractionHold,
  });

  // Fingerprint the initialized builder after hydration for dirty-state tracking.
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
        if (cancelled) return;
        if (detail.productType !== "bracelet" || !detail.bracelet) {
          hydratedDesignRef.current = designIdFromUrl;
          clearStaleDesignUrl(designIdFromUrl, setSavedDesignId, setSearchParams);
          setHydrationDone(true);
          toast.error(CUSTOMER_COPY.saveDesignFailed);
          return;
        }
        builder.loadFromSaved({
          twinning: detail.bracelet.twinning,
          wristSizeCmA: detail.bracelet.wristSizeCmA,
          wristSizeCmB: detail.bracelet.wristSizeCmB,
          items: detail.bracelet.items.map((item) => ({
            strandIndex: item.strandIndex,
            slotPosition: item.slotPosition,
            beadLibraryId: item.beadLibraryId,
            beadSizeMm: item.beadSizeMm,
            offerKey: item.offerKey,
            catalogIssue: item.catalogIssue ?? null,
            unitPrice: item.unitPrice,
            flipped: item.flipped,
            frame: item.frame
              ? {
                  beadLibraryId: item.frame.beadLibraryId,
                  beadSizeMm: item.frame.beadSizeMm,
                  offerKey: item.frame.offerKey,
                }
              : undefined,
          })),
        });
        setBraceletName(detail.title?.trim() ?? "");
        setSavedDesignId(detail.id);
        hydratedDesignRef.current = designIdFromUrl;
        setHydrationDone(true);
      } catch (err) {
        if (!cancelled) {
          hydratedDesignRef.current = designIdFromUrl;
          clearStaleDesignUrl(designIdFromUrl, setSavedDesignId, setSearchParams);
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
    onToggleTwinning: () => {
      const enabling = !builder.twinning;
      builder.handleToggleTwinning();
      if (isMobile && enabling) setMobileViewMode("mirror");
    },
    onMatchBracelets: builder.handleMatchBracelets,
    onUnmatchBracelets: builder.handleUnmatchBracelets,
    matchDisabled: !builder.canMatchBracelets,
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
    if (builder.hasUnavailableBeads) {
      toast.error(BRACELET_COPY.checkoutBlockedUnavailable);
      return;
    }

    let designId = savedDesignId;
    if (!designId || hasPendingChanges()) {
      try {
        const saved = await flush();
        designId = saved?.id ?? savedDesignId;
      } catch (err) {
        toast.error(formatDesignSaveError(err));
        return;
      }
    }
    if (!designId) {
      toast.error(CUSTOMER_COPY.saveDesignFailed);
      return;
    }
    setCheckoutOpen(true);
  }, [
    user,
    openAuth,
    builder.pricing.placedCount,
    builder.isOverCapacity,
    builder.hasUnavailableBeads,
    savedDesignId,
    flush,
    hasPendingChanges,
  ]);

  const handleSaveDesign = useCallback(async () => {
    if (builder.pricing.placedCount === 0) {
      toast.error(CUSTOMER_COPY.saveDesignNeedBeads);
      return;
    }
    if (builder.isOverCapacity) {
      toast.error(BRACELET_COPY.saveBlockedOverCapacity);
      return;
    }
    if (builder.hasUnavailableBeads) {
      toast.error(BRACELET_COPY.saveBlockedUnavailable);
      return;
    }

    setSavingDesign(true);
    try {
      if (user && hasPendingChanges()) {
        const saved = await flush();
        if (saved) {
          toast.success(CUSTOMER_COPY.saveDesignSuccess(saved.id));
          return;
        }
        // null = auth modal opened (401), offline, or no buildable payload.
        // Real API failures now throw from flush() and are handled below.
        return;
      }

      const request = await buildBraceletRequest({ includeThumbnail: true });
      if (!request) {
        toast.error(CUSTOMER_COPY.saveDesignNeedBeads);
        return;
      }

      // Unauthenticated: saveDesign stores a pending save and opens the auth modal;
      // the pending-design listener resumes the save after sign-in.
      // silent: caller owns toasts (avoids duplicate success messages).
      const saved = await saveDesign(request, {
        designId: savedDesignId ?? undefined,
        silent: true,
      });
      if (saved) {
        handleDesignSaved(saved);
        if (braceletPayload) {
          setBaseline(
            fingerprintBraceletPayload(braceletPayload, saved.title ?? braceletName),
            fingerprintBraceletVisual(braceletPayload),
          );
        }
        await clearLocalDraft();
        toast.success(CUSTOMER_COPY.saveDesignSuccess(saved.id));
      }
    } catch (err) {
      toast.error(formatDesignSaveError(err));
    } finally {
      setSavingDesign(false);
    }
  }, [
    user,
    savedDesignId,
    hasPendingChanges,
    flush,
    buildBraceletRequest,
    saveDesign,
    handleDesignSaved,
    builder.pricing.placedCount,
    builder.isOverCapacity,
    builder.hasUnavailableBeads,
    braceletPayload,
    braceletName,
    setBaseline,
    clearLocalDraft,
  ]);

  const saveDisabled =
    builder.pricing.placedCount === 0 || builder.isOverCapacity || builder.hasUnavailableBeads;

  const summaryPanelProps = {
    summary: builder.summary,
    howWePrepareOptions: builder.howWePrepareOptions,
    preparationSelection: builder.preparationSelection,
    onSelectPreparation: builder.selectPreparation,
    onPreparationQuantityChange: builder.setPreparationQuantity,
    glamOptions: builder.glamOptions,
    glamSelection: builder.glamSelection,
    onSelectGlam: builder.selectGlam,
    onAddToCart: () => void handleAddToCart(),
    onSaveDesign: () => void handleSaveDesign(),
    savingDesign,
    saveDisabled,
    autoSaveStatus,
    autoSaveVisible: builder.wristSizeConfirmed,
    signedIn: Boolean(user),
  };

  // Mobile review sheet reuses the same panel, but its Add-to-cart closes the
  // sheet first so checkout opens cleanly on top of the canvas.
  const mobileSummaryProps = {
    ...summaryPanelProps,
    onAddToCart: () => {
      setSummaryOpen(false);
      void handleAddToCart();
    },
  };

  if (!wristConfirmed) {
    return (
      <>
        <div
          className="relative flex h-full w-full flex-1 flex-col animate-fade-in"
          style={{ background: "#fbf8f1" }}
        >
          <div className="flex min-h-0 flex-1 justify-center overflow-y-auto px-6 py-10 sm:p-16">
            <WristSizeStep
              className="my-auto"
              sizes={builder.wristSizes}
              selectedId={builder.draftWristIdA}
              onSelect={builder.selectDraftWristA}
              onConfirm={builder.confirmWristSizes}
            />
          </div>
        </div>
        {leaveGuard}
      </>
    );
  }

  const activeStrandSummary =
    mobileViewMode === "B" && builder.summary.strands[1]
      ? builder.summary.strands[1]!
      : builder.summary.strands[0];

  const canvasPanel = (
    <div
      ref={containerRef}
      className="surface-canvas relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
    >
      {isMobile ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-border/50 px-3 py-2">
          <BraceletMobileStrandSwitcher
            className="min-w-0 flex-1"
            mode={mobileViewMode}
            onChange={handleMobileViewModeChange}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl border border-border/50"
            aria-label={BRACELET_COPY.mobileOpenOptions}
            onClick={() => setOptionsOpen(true)}
          >
            <Settings2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl border border-border/50"
            aria-label="Starters"
            onClick={() => toast.message(BRACELET_COPY.dragOnboardingInitial)}
          >
            <Sparkles className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl border border-border/50 hover:bg-destructive/10 hover:text-destructive"
            title={BRACELET_COPY.clearStrand}
            aria-label={BRACELET_COPY.clearStrand}
            disabled={builder.pricing.placedCount === 0}
            onClick={builder.handleReset}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden p-0.5 sm:p-1">
      {builder.selectedBead && isMobile ? (
        <div className="absolute left-3 right-3 top-12 z-30 flex items-center gap-2 rounded-lg border border-border/50 bg-background/90 px-3 py-2 backdrop-blur-sm">
          {getBeadDisplayImageUrl(builder.selectedBead) ? (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden">
              <img
                src={getBeadDisplayImageUrl(builder.selectedBead)!}
                alt=""
                className="max-h-full max-w-full object-contain"
                style={getBeadLibraryThumbnailStyle(builder.selectedBead)}
              />
            </div>
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
        {showMatchingPairPreview ? (
          <span className="rounded-full border border-primary/25 bg-background/90 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-foreground shadow-sm backdrop-blur-sm">
            {BRACELET_COPY.matchingPairTitle} · {BRACELET_COPY.matchingPairPreviewHint}
          </span>
        ) : null}
      </div>

      <div className="pointer-events-none absolute left-3 right-3 top-2 z-30 flex flex-col gap-2 sm:left-auto sm:right-4 sm:max-w-sm sm:top-12">
        {builder.hasUnavailableBeads ? (
          <CapacityAlertBanner
            variant="over"
            message={BRACELET_COPY.unavailableBeadsNotice}
            className="pointer-events-auto"
          />
        ) : null}
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
        zoom={displayZoom}
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

      {isMobile ? (
        <p className="pointer-events-none absolute bottom-3 right-3 z-30 text-[11px] tabular-nums text-muted-foreground sm:bottom-4 sm:right-4">
          {BRACELET_COPY.mobilePieces(builder.pricing.placedCount)}
        </p>
      ) : (
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
      )}

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
          twinning={showMatchingPairPreview}
          matchingPairLayout={matchingPairLayout}
          onPointerDown={onPanPointerDown}
          onPointerMove={onPanPointerMove}
          onPointerUp={onPanPointerUp}
          onPointerCancel={onPanPointerCancel}
        >
          {showStrandA ? (
          <StrandStage
            className="shrink-0"
            style={{
              width: strandSize,
              height: builder.twinning
                ? strandSize + MATCHING_PAIR_CHROME_HEIGHT_PX
                : strandSize,
              minWidth: strandSize,
              minHeight: builder.twinning
                ? strandSize + MATCHING_PAIR_CHROME_HEIGHT_PX
                : strandSize,
            }}
          >
            <SortableCircularStrand
              key={`a-${layoutKey}`}
              layoutKey={layoutKey}
              placedBeads={builder.placedBeadsA}
              onBeadsReorder={(from, to) => builder.handleBeadsReorder("A", from, to)}
              onSlotClick={(pos) => {
                builder.handleSlotClick("A", pos);
              }}
              onBeadDrop={(target, data) => builder.handleBeadDrop("A", target, data)}
              onBeadRemove={(pos) => builder.handleRemoveBead("A", pos)}
              onFrameRemove={(pos) => builder.handleRemoveFrame("A", pos)}
              onFlip={(pos) => builder.handleToggleFlip("A", pos)}
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
              onStrandDragActiveChange={setStrandDragActive}
              pathStartAngle={builder.strandAnchorAngleA}
              size={layoutCanvasSize}
            />
          </StrandStage>
          ) : null}

          {showStrandB ? (
            <StrandStage
              className="shrink-0"
              style={{
                width: strandSize,
                height: strandSize + MATCHING_PAIR_CHROME_HEIGHT_PX,
                minWidth: strandSize,
                minHeight: strandSize + MATCHING_PAIR_CHROME_HEIGHT_PX,
              }}
            >
              <SortableCircularStrand
                key={`b-${layoutKey}`}
                layoutKey={layoutKey}
                placedBeads={builder.placedBeadsB}
                onBeadsReorder={(from, to) => builder.handleBeadsReorder("B", from, to)}
                onSlotClick={(pos) => {
                  builder.handleSlotClick("B", pos);
                }}
                onBeadDrop={(target, data) => builder.handleBeadDrop("B", target, data)}
                onBeadRemove={(pos) => builder.handleRemoveBead("B", pos)}
                onFrameRemove={(pos) => builder.handleRemoveFrame("B", pos)}
                onFlip={(pos) => builder.handleToggleFlip("B", pos)}
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
                onStrandDragActiveChange={setStrandDragActive}
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
            braceletBMatched={builder.braceletBMatched}
            wristSizes={builder.wristSizes}
            wristSizeIdA={builder.wristSizeIdA}
            wristSizeIdB={builder.wristSizeIdB}
            onSelectWristA={builder.setWristA}
            onSelectWristB={builder.setWristB}
            onSelectBead={(bead, size) =>
              builder.handleSelectBead(bead, size, builder.activePlacementStrand)
            }
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
      rightPanel={!isMobile ? <BraceletSummaryPanel {...summaryPanelProps} embedded /> : undefined}
      mobileFooter={
        isMobile ? (
          <div className="flex shrink-0 flex-col gap-2 bg-background/95 px-3 pt-2 pb-[env(safe-area-inset-bottom)]">
            {activeStrandSummary ? (
              <BraceletMobileStatusCard
                strand={activeStrandSummary}
                totalPrice={builder.pricing.total}
                currencyCode={builder.pricing.currencyCode}
                twinning={builder.twinning}
                strandIndex={mobileViewMode === "B" ? 2 : 1}
                onAddToCart={() => setSummaryOpen(true)}
                addDisabled={saveDisabled}
              />
            ) : null}
            <BeadLibrary
              variant="mobile-rail"
              open
              onClose={() => {}}
              onSelectBead={(bead, size) =>
                builder.handleSelectBead(
                  bead,
                  size,
                  mobileViewMode === "B" ? "B" : "A",
                )
              }
              onLibraryDragActiveChange={setLibraryDragActive}
              onLibraryDragChange={(active, payload) => {
                setLibraryDragActive(active);
                setLibraryDragPreview(active ? (payload ?? null) : null);
              }}
            />
            <p className="px-0.5 pb-1 text-center text-[10px] leading-relaxed text-muted-foreground">
              {BRACELET_COPY.mobileLibraryHint}
              <button
                type="button"
                className="text-foreground/80 underline-offset-2 hover:underline"
                onClick={() => setOptionsOpen(true)}
              >
                {BRACELET_COPY.mobileLibraryHintOptions}
              </button>
            </p>
          </div>
        ) : undefined
      }
    />
    {isMobile ? (
      <BraceletMobileOptionsDrawer
        open={optionsOpen}
        onOpenChange={setOptionsOpen}
        braceletName={braceletName}
        onBraceletNameChange={setBraceletName}
        wristSizes={builder.wristSizes}
        wristSizeIdA={builder.wristSizeIdA}
        wristSizeIdB={builder.wristSizeIdB}
        twinning={builder.twinning}
        braceletBMatched={builder.braceletBMatched}
        onSelectWristA={builder.setWristA}
        onSelectWristB={builder.setWristB}
        onMeasureWrist={() =>
          toast.message(BRACELET_COPY.wristStepSubtitle)
        }
        onLoadDesignCode={(code) => {
          setSearchParams({ design: code }, { replace: true });
          setOptionsOpen(false);
          toast.message(`Loading design ${code}…`);
        }}
        builderActions={builderActions}
      />
    ) : null}
    {isMobile ? (
      <BraceletMobileSummaryDrawer
        open={summaryOpen}
        onOpenChange={setSummaryOpen}
        summaryProps={mobileSummaryProps}
      />
    ) : null}
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
      preparation={builder.preparationSelection}
    />
    {leaveGuard}
    </>
  );
};

export default BraceletBuilder;
