import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorState, LoadingState } from "@/components/common";
import { CUSTOMER_COPY } from "@/lib/customer-copy";
import { useSiteGeneralSettings } from "@/hooks/use-site-settings";
import { CheckoutDialog } from "@/features/account/components/CheckoutDialog";
import { setPendingDesignListener } from "@/features/designs/pending-design";
import { captureSunglassesThumbnail } from "@/features/designs/capture-thumbnail";
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

interface SunglassesCustomiserProps {
  onPriceChange: (price: number) => void;
}

export function SunglassesCustomiser({ onPriceChange }: SunglassesCustomiserProps) {
  const [searchParams] = useSearchParams();
  const designIdFromUrl = searchParams.get("design");
  const { user, saveDesign, openAuth } = useAuth();
  const state = useSunglassesCustomiserState(onPriceChange);
  const flow = useCustomiserFlow();
  const { data: siteSettings } = useSiteGeneralSettings();
  const currencyCode = siteSettings.currencyCode;
  const { sunglassesCatalog } = state;
  const [saving, setSaving] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [savedDesignId, setSavedDesignId] = useState<string | null>(designIdFromUrl);
  const hydratedDesignRef = useRef<string | null>(null);

  useEffect(() => {
    setPendingDesignListener((result) => {
      if (result?.productType === "sunglasses") {
        setSavedDesignId(result.id);
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
    if (sunglassesCatalog.isHydrating && sunglassesCatalog.lensTints.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const detail = await designsApi.get(designIdFromUrl);
        if (cancelled || detail.productType !== "sunglasses" || !detail.sunglasses) return;

        const saved = detail.sunglasses;
        if (state.frames.some((f) => f.id === saved.frameId)) {
          state.selectFrameSku(saved.frameId);
        }
        if (sunglassesCatalog.getTintById(saved.lensTintId)) {
          state.selectTintById(saved.lensTintId);
        }
        state.dispatch({ type: "SET_OPTIONS", options: saved.selectedOptions });
        if (saved.builderStep) {
          flow.goTo(saved.builderStep as CustomiserStep);
        }
        setSavedDesignId(detail.id);
        hydratedDesignRef.current = designIdFromUrl;
      } catch (err) {
        if (!cancelled) {
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
    state.frames,
    state.selectFrameSku,
    state.selectTintById,
    state.dispatch,
    flow.goTo,
  ]);

  const handleSaveDesign = useCallback(async () => {
    setSaving(true);
    try {
      const tintId = state.selectedTintEntry?.id;
      if (!tintId) {
        toast.error("Select a lens tint before saving.");
        return null;
      }
      const previewThumbnailDataUrl =
        (await captureSunglassesThumbnail(state.compositorConfig)) ?? undefined;
      const saved = await saveDesign(
        {
          productType: "sunglasses",
          title: `${state.frameSku.name} sunglasses`,
          status: "saved",
          previewThumbnailDataUrl,
          sunglasses: {
            frameId: state.frameSku.id,
            lensTintId: tintId,
            selectedOptions: state.config.options,
            builderStep: flow.step,
            subtotal: state.totalPrice,
            currencyCode,
          },
        },
        { designId: savedDesignId ?? undefined },
      );
      if (saved) setSavedDesignId(saved.id);
      return saved;
    } catch {
      return null;
    } finally {
      setSaving(false);
    }
  }, [
    saveDesign,
    savedDesignId,
    state.frameSku.id,
    state.frameSku.name,
    state.compositorConfig,
    state.selectedTintEntry?.id,
    state.config.options,
    state.totalPrice,
    flow.step,
    currencyCode,
  ]);

  const handleAddToCart = useCallback(async () => {
    if (!user) {
      openAuth({ mode: "sign-in" });
      return;
    }
    if (flow.step !== "preview") {
      toast.message("Complete the review step before checkout.");
      flow.goTo("preview");
      return;
    }

    let designId = savedDesignId;
    if (!designId) {
      const saved = await handleSaveDesign();
      designId = saved?.id ?? null;
    }
    if (!designId) return;
    setCheckoutOpen(true);
  }, [user, openAuth, flow, savedDesignId, handleSaveDesign]);

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
        mobileSteps={<SunglassesHorizontalSteps current={flow.step} onSelect={flow.goTo} />}
        preview={<SunglassesPreviewPanel config={state.compositorConfig} />}
        configuration={
          <SunglassesConfigColumn
            flow={flow}
            state={state}
            currencyCode={currencyCode}
            onSaveDesign={() => void handleSaveDesign()}
            onAddToCart={handleAddToCart}
            saving={saving}
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
