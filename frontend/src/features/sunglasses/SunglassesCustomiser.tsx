import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  clearStaleDesignUrl,
  createRecoveringSaveDesign,
} from "@/features/designs/recovering-save-design";
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
  const [savingDesign, setSavingDesign] = useState(false);
  // Save is configurable whenever a tint is chosen — independent of auth so the
  // Save button can trigger the login flow and resume the save afterwards.
  const canConfigureSave = Boolean(tintId && !state.hasUnavailableFrame);
  // Track dirty + local drafts for everyone; server writes only via explicit Save / checkout flush.
  const draftTrackingEnabled = canConfigureSave;

  const autoSavePaused = Boolean(designIdFromUrl && user && !hydrationDone);

  const sunglassesPayload = useMemo(() => {
    if (!canConfigureSave || !tintId) return null;
    return {
      frameId: state.frameSku.id,
      lensTintId: tintId,
      selectedOptions: state.config.options,
      builderStep: flow.step,
      subtotal: state.totalPrice,
      currencyCode,
      title: `${state.frameSku.name} sunglasses`,
    };
  }, [
    canConfigureSave,
    tintId,
    state.frameSku.id,
    state.frameSku.name,
    state.config.options,
    flow.step,
    state.totalPrice,
    currencyCode,
  ]);

  const getSunglassesFingerprint = useCallback(() => {
    if (!sunglassesPayload) return null;
    return fingerprintSunglassesConfig(
      {
        frameId: sunglassesPayload.frameId,
        lensTintId: sunglassesPayload.lensTintId,
        selectedOptions: sunglassesPayload.selectedOptions,
        builderStep: sunglassesPayload.builderStep,
        subtotal: sunglassesPayload.subtotal,
        currencyCode: sunglassesPayload.currencyCode,
      },
      sunglassesPayload.title,
    );
  }, [sunglassesPayload]);

  const getSunglassesVisualFingerprint = useCallback(() => {
    if (!sunglassesPayload) return null;
    return fingerprintSunglassesVisual({
      frameId: sunglassesPayload.frameId,
      lensTintId: sunglassesPayload.lensTintId,
      selectedOptions: sunglassesPayload.selectedOptions,
    });
  }, [sunglassesPayload]);

  const buildSunglassesRequest = useCallback(
    async (ctx: { includeThumbnail: boolean }) => {
      if (!sunglassesPayload || state.hasUnavailableFrame || isUnavailableFrame(state.frameSku)) {
        return null;
      }
      let previewThumbnailDataUrl: string | undefined;
      if (ctx.includeThumbnail) {
        previewThumbnailDataUrl =
          (await captureSunglassesThumbnail(state.compositorConfig)) ?? undefined;
      }
      return {
        productType: "sunglasses" as const,
        title: sunglassesPayload.title,
        status: "saved" as const,
        previewThumbnailDataUrl,
        sunglasses: {
          frameId: sunglassesPayload.frameId,
          lensTintId: sunglassesPayload.lensTintId,
          selectedOptions: sunglassesPayload.selectedOptions,
          builderStep: sunglassesPayload.builderStep,
          subtotal: sunglassesPayload.subtotal,
          currencyCode: sunglassesPayload.currencyCode,
        },
      };
    },
    [sunglassesPayload, state.compositorConfig, state.hasUnavailableFrame, state.frameSku],
  );

  const handleStaleDesignId = useCallback(() => {
    clearStaleDesignUrl(designIdFromUrl, setSavedDesignId, setSearchParams);
  }, [designIdFromUrl, setSearchParams]);

  const saveDesignForAutoSave = useMemo(
    () => createRecoveringSaveDesign(saveDesign, handleStaleDesignId),
    [saveDesign, handleStaleDesignId],
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
    productType: "sunglasses",
    designId: savedDesignId,
    saveDesign: saveDesignForAutoSave,
    onSaved: handleDesignSaved,
    getFingerprint: getSunglassesFingerprint,
    getVisualFingerprint: getSunglassesVisualFingerprint,
    buildRequest: buildSunglassesRequest,
  });

  useEffect(() => {
    if (!hydrationDone || baselineSetRef.current || !sunglassesPayload) return;
    const fp = fingerprintSunglassesConfig(
      {
        frameId: sunglassesPayload.frameId,
        lensTintId: sunglassesPayload.lensTintId,
        selectedOptions: sunglassesPayload.selectedOptions,
        builderStep: sunglassesPayload.builderStep,
        subtotal: sunglassesPayload.subtotal,
        currencyCode: sunglassesPayload.currencyCode,
      },
      sunglassesPayload.title,
    );
    const visual = fingerprintSunglassesVisual({
      frameId: sunglassesPayload.frameId,
      lensTintId: sunglassesPayload.lensTintId,
      selectedOptions: sunglassesPayload.selectedOptions,
    });
    setBaseline(fp, visual);
    baselineSetRef.current = true;
  }, [hydrationDone, sunglassesPayload, setBaseline]);

  useEffect(() => {
    setPendingDesignListener((result) => {
      if (result?.productType === "sunglasses") {
        handleDesignSaved(result);
        if (sunglassesPayload) {
          setBaseline(
            fingerprintSunglassesConfig(
              {
                frameId: sunglassesPayload.frameId,
                lensTintId: sunglassesPayload.lensTintId,
                selectedOptions: sunglassesPayload.selectedOptions,
                builderStep: sunglassesPayload.builderStep,
                subtotal: sunglassesPayload.subtotal,
                currencyCode: sunglassesPayload.currencyCode,
              },
              result.title ?? sunglassesPayload.title,
            ),
            fingerprintSunglassesVisual({
              frameId: sunglassesPayload.frameId,
              lensTintId: sunglassesPayload.lensTintId,
              selectedOptions: sunglassesPayload.selectedOptions,
            }),
          );
        }
      }
    });
    return () => setPendingDesignListener(null);
  }, [handleDesignSaved, sunglassesPayload, setBaseline]);

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
        if (cancelled) return;
        if (detail.productType !== "sunglasses" || !detail.sunglasses) {
          hydratedDesignRef.current = designIdFromUrl;
          clearStaleDesignUrl(designIdFromUrl, setSavedDesignId, setSearchParams);
          setHydrationDone(true);
          toast.error(CUSTOMER_COPY.saveDesignFailed);
          return;
        }

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
    sunglassesCatalog.isHydrating,
    sunglassesCatalog.lensTints.length,
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

  const handleSaveDesign = useCallback(async () => {
    if (state.hasUnavailableFrame || isUnavailableFrame(state.frameSku)) {
      toast.message(SUNGLASSES_COPY.checkoutBlockedUnavailableFrame);
      flow.goTo("frame");
      return;
    }
    if (!sunglassesPayload) {
      toast.message(SUNGLASSES_COPY.saveDesignNeedsTint);
      flow.goTo("lens");
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
        if (hasPendingChanges()) {
          toast.error(CUSTOMER_COPY.saveDesignFailed);
          return;
        }
      }

      const request = await buildSunglassesRequest({ includeThumbnail: true });
      if (!request) return;

      // When unauthenticated, saveDesign stores a pending save and opens the auth
      // modal; the pending-design listener resumes the save after sign-in.
      const saved = await saveDesign(request, { designId: savedDesignId ?? undefined });
      if (saved) {
        handleDesignSaved(saved);
        setBaseline(
          fingerprintSunglassesConfig(
            {
              frameId: sunglassesPayload.frameId,
              lensTintId: sunglassesPayload.lensTintId,
              selectedOptions: sunglassesPayload.selectedOptions,
              builderStep: sunglassesPayload.builderStep,
              subtotal: sunglassesPayload.subtotal,
              currencyCode: sunglassesPayload.currencyCode,
            },
            saved.title ?? sunglassesPayload.title,
          ),
          fingerprintSunglassesVisual({
            frameId: sunglassesPayload.frameId,
            lensTintId: sunglassesPayload.lensTintId,
            selectedOptions: sunglassesPayload.selectedOptions,
          }),
        );
        await clearLocalDraft();
        toast.success(CUSTOMER_COPY.saveDesignSuccess(saved.id));
      }
    } catch (err) {
      toast.error(isApiError(err) ? err.message : CUSTOMER_COPY.saveDesignFailed);
    } finally {
      setSavingDesign(false);
    }
  }, [
    user,
    sunglassesPayload,
    savedDesignId,
    hasPendingChanges,
    flush,
    buildSunglassesRequest,
    saveDesign,
    handleDesignSaved,
    flow,
    state.hasUnavailableFrame,
    state.frameSku,
    setBaseline,
    clearLocalDraft,
  ]);

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
              plateOnly={flow.step === "frame"}
            />
          </div>
        }
        configuration={
          <SunglassesConfigColumn
            flow={flow}
            state={state}
            currencyCode={currencyCode}
            onAddToCart={handleAddToCart}
            onSaveDesign={handleSaveDesign}
            savingDesign={savingDesign}
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
    />
    {leaveGuard}
    </>
  );
}

export default SunglassesCustomiser;
