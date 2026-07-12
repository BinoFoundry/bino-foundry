import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorState, LoadingState } from "@/components/common";
import { CUSTOMER_COPY } from "@/lib/customer-copy";
import { useSiteGeneralSettings } from "@/hooks/use-site-settings";
import { CheckoutDialog } from "@/features/account/components/CheckoutDialog";
import { captureSunglassesThumbnail } from "@/features/designs/capture-thumbnail";
import { fingerprintSunglassesConfig, fingerprintSunglassesVisual } from "@/features/designs/design-save-fingerprint";
import { setPendingDesignListener } from "@/features/designs/pending-design";
import { useDesignAutoSave } from "@/features/designs/useDesignAutoSave";
import type { CustomiserStep } from "@/features/sunglasses/constants";
import { designsApi } from "@/services/api/designs";
import { isApiError } from "@/services/api/errors";
import { useAuth } from "@/state/auth/AuthProvider";

import { SunglassesConfigColumn } from "./components/SunglassesConfigColumn";
import { SunglassesHorizontalSteps } from "./components/SunglassesHorizontalSteps";
import { SunglassesPreviewPanel } from "./components/SunglassesPreviewPanel";
import { useCustomiserFlow } from "./hooks/useCustomiserFlow";
import { useSunglassesCustomiserState } from "./hooks/useSunglassesCustomiserState";
import { SunglassesBuilderLayout } from "./layout/SunglassesBuilderLayout";
import { CapacityAlertBanner } from "@/features/bracelet/components/CapacityAlertBanner";
import { isUnavailableFrame } from "./unavailable-frame";
import { SUNGLASSES_COPY } from "./copy";

interface SunglassesCustomiserProps {
  onPriceChange: (price: number) => void;
}

export function SunglassesCustomiser({ onPriceChange }: SunglassesCustomiserProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const designIdFromUrl = searchParams.get("design");
  const { user, saveDesign, openAuth } = useAuth();
  const state = useSunglassesCustomiserState(onPriceChange);
  const flow = useCustomiserFlow();
  const { data: siteSettings } = useSiteGeneralSettings();
  const currencyCode = siteSettings.currencyCode;
  const { sunglassesCatalog } = state;
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [savedDesignId, setSavedDesignId] = useState<string | null>(designIdFromUrl);
  const [hydrationDone, setHydrationDone] = useState(!designIdFromUrl);
  const baselineSetRef = useRef(false);
  const hydratedDesignRef = useRef<string | null>(null);

  const tintId = state.selectedTintEntry?.id;
  const autoSaveEnabled = Boolean(user && tintId && !state.hasUnavailableFrame);

  const autoSavePaused = Boolean(designIdFromUrl && user && !hydrationDone);

  const getSunglassesFingerprint = useCallback(() => {
    if (!tintId) return null;
    return fingerprintSunglassesConfig(
      {
        frameId: state.frameSku.id,
        lensTintId: tintId,
        selectedOptions: state.config.options,
        builderStep: flow.step,
        subtotal: state.totalPrice,
        currencyCode,
      },
      `${state.frameSku.name} sunglasses`,
    );
  }, [
    tintId,
    state.frameSku.id,
    state.frameSku.name,
    state.config.options,
    flow.step,
    state.totalPrice,
    currencyCode,
  ]);

  const getSunglassesVisualFingerprint = useCallback(() => {
    if (!tintId) return null;
    return fingerprintSunglassesVisual({
      frameId: state.frameSku.id,
      lensTintId: tintId,
      selectedOptions: state.config.options,
    });
  }, [tintId, state.frameSku.id, state.config.options]);

  const buildSunglassesRequest = useCallback(
    async (ctx: { includeThumbnail: boolean }) => {
      if (!tintId || state.hasUnavailableFrame || isUnavailableFrame(state.frameSku)) return null;
      let previewThumbnailDataUrl: string | undefined;
      if (ctx.includeThumbnail) {
        previewThumbnailDataUrl =
          (await captureSunglassesThumbnail(state.compositorConfig)) ?? undefined;
      }
      return {
        productType: "sunglasses" as const,
        title: `${state.frameSku.name} sunglasses`,
        status: "saved" as const,
        previewThumbnailDataUrl,
        sunglasses: {
          frameId: state.frameSku.id,
          lensTintId: tintId,
          selectedOptions: state.config.options,
          builderStep: flow.step,
          subtotal: state.totalPrice,
          currencyCode,
        },
      };
    },
    [
      tintId,
      state.compositorConfig,
      state.frameSku.id,
      state.frameSku.name,
      state.config.options,
      flow.step,
      state.totalPrice,
      currencyCode,
      state.hasUnavailableFrame,
      state.frameSku,
    ],
  );

  const handleDesignSaved = useCallback(
    (saved: { id: string }) => {
      setSavedDesignId(saved.id);
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
    getFingerprint: getSunglassesFingerprint,
    getVisualFingerprint: getSunglassesVisualFingerprint,
    buildRequest: buildSunglassesRequest,
    debounceMs: 1000,
  });

  useEffect(() => {
    if (!hydrationDone || baselineSetRef.current || !tintId) return;
    const fp = getSunglassesFingerprint();
    const visual = getSunglassesVisualFingerprint();
    if (fp && visual) {
      setBaseline(fp, visual);
      baselineSetRef.current = true;
    }
  }, [
    hydrationDone,
    tintId,
    getSunglassesFingerprint,
    getSunglassesVisualFingerprint,
    setBaseline,
  ]);

  useEffect(() => {
    setPendingDesignListener((result) => {
      if (result?.productType === "sunglasses") {
        handleDesignSaved(result);
        const fp = getSunglassesFingerprint();
        const visual = getSunglassesVisualFingerprint();
        if (fp && visual) setBaseline(fp, visual);
      }
    });
    return () => setPendingDesignListener(null);
  }, [handleDesignSaved, getSunglassesFingerprint, getSunglassesVisualFingerprint, setBaseline]);

  useEffect(() => {
    if (designIdFromUrl) setSavedDesignId(designIdFromUrl);
  }, [designIdFromUrl]);

  useEffect(() => {
    if (!designIdFromUrl || !user) return;
    if (hydratedDesignRef.current === designIdFromUrl) return;
    if (sunglassesCatalog.isHydrating && sunglassesCatalog.lensTints.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const detail = await designsApi.get(designIdFromUrl);
        if (cancelled || detail.productType !== "sunglasses" || !detail.sunglasses) return;

        const saved = detail.sunglasses;
        state.applyLoadedFrame(saved.frameId, saved.catalogIssue ?? undefined);
        if (sunglassesCatalog.getTintById(saved.lensTintId)) {
          state.selectTintById(saved.lensTintId);
        }
        state.dispatch({ type: "SET_OPTIONS", options: saved.selectedOptions });
        if (saved.builderStep) {
          flow.goTo(saved.builderStep as CustomiserStep);
        }
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
    sunglassesCatalog.isHydrating,
    sunglassesCatalog.lensTints.length,
    sunglassesCatalog,
    state.applyLoadedFrame,
    state.selectTintById,
    state.dispatch,
    flow.goTo,
  ]);

  const handleAddToCart = useCallback(async () => {
    if (!user) {
      openAuth({ mode: "sign-in" });
      return;
    }
    if (state.hasUnavailableFrame) {
      toast.message(SUNGLASSES_COPY.checkoutBlockedUnavailableFrame);
      flow.goTo("frame");
      return;
    }
    if (flow.step !== "preview") {
      toast.message("Complete the review step before checkout.");
      flow.goTo("preview");
      return;
    }

    let designId = savedDesignId;
    if (!designId || hasPendingChanges()) {
      const saved = await flush();
      designId = saved?.id ?? savedDesignId;
    }
    if (!designId) return;
    setCheckoutOpen(true);
  }, [user, openAuth, flow, savedDesignId, flush, hasPendingChanges, state.hasUnavailableFrame]);

  if (sunglassesCatalog.isHydrating && sunglassesCatalog.lensTints.length === 0) {
    return <LoadingState label="Loading sunglasses options…" className="h-full" />;
  }

  if (sunglassesCatalog.hydrateError && sunglassesCatalog.lensTints.length === 0) {
    return (
      <ErrorState
        message={CUSTOMER_COPY.sunglassesLoadFailed}
        onRetry={() => void sunglassesCatalog.refreshFromApi()}
        className="m-6"
      />
    );
  }

  return (
    <>
    <TooltipProvider delayDuration={200}>
      <SunglassesBuilderLayout
        mobileSteps={
          <div className="flex items-center justify-between gap-3">
            <SunglassesHorizontalSteps current={flow.step} onSelect={flow.goTo} />
          </div>
        }
        preview={
          <div className="relative h-full min-h-0">
            {state.hasUnavailableFrame ? (
              <div className="pointer-events-none absolute left-3 right-3 top-2 z-30 sm:left-auto sm:right-4 sm:max-w-sm sm:top-3">
                <CapacityAlertBanner
                  variant="over"
                  message={SUNGLASSES_COPY.unavailableFrameNotice}
                  className="pointer-events-auto"
                />
              </div>
            ) : null}
            <SunglassesPreviewPanel
              config={state.compositorConfig}
              unavailableFrame={isUnavailableFrame(state.frameSku)}
            />
          </div>
        }
        configuration={
          <SunglassesConfigColumn
            flow={flow}
            state={state}
            currencyCode={currencyCode}
            onAddToCart={handleAddToCart}
            autoSaveStatus={autoSaveStatus}
            autoSaveVisible
            signedIn={Boolean(user)}
            checkoutDisabled={state.hasUnavailableFrame}
          />
        }
      />
    </TooltipProvider>
    <CheckoutDialog
      open={checkoutOpen}
      onOpenChange={setCheckoutOpen}
      designId={savedDesignId}
      productLabel={`${state.frameSku.name} sunglasses`}
      totalAmount={state.totalPrice}
      currencyCode={currencyCode}
      defaultEmail={user?.email}
      defaultName={user?.displayName}
    />
    </>
  );
}

export default SunglassesCustomiser;
