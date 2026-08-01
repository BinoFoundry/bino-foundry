import { useCallback, useEffect, useRef, useState } from "react";
import { useBlocker } from "react-router-dom";

import type { DesignProductType, SaveDesignRequest, SavedDesignSummary } from "@bino-foundry/shared/types";

import { LEAVE_PAGE_WARNING } from "./builder-save-copy";
import {
  clearBuilderLocalDraft,
  builderDraftKey,
  writeBuilderLocalDraft,
} from "./builder-local-draft";
import {
  DesignAutoSaveController,
  type DesignAutoSaveBuildFn,
  type DesignAutoSaveStatus,
  type DesignPersistMode,
} from "./design-autosave-controller";
import { BuilderUnsavedLeaveDialog } from "./BuilderUnsavedLeaveDialog";

const LOCAL_DRAFT_DEBOUNCE_MS = 300;

export interface UseDesignAutoSaveOptions {
  /** Track dirty state + local drafts. Server save only happens via `flush()` in explicit mode. */
  enabled: boolean;
  paused?: boolean;
  /** When true (autosave mode only), dirty state is tracked but saves wait until the interaction ends. */
  interactionHold?: boolean;
  productType: DesignProductType;
  designId: string | null;
  saveDesign: (
    request: SaveDesignRequest,
    options?: { designId?: string; silent?: boolean },
  ) => Promise<SavedDesignSummary | null>;
  onSaved?: (summary: SavedDesignSummary) => void;
  getFingerprint: () => string | null;
  getVisualFingerprint?: () => string | null;
  buildRequest: DesignAutoSaveBuildFn;
  debounceMs?: number;
  /** Default `explicit`. */
  mode?: DesignPersistMode;
}

export function useDesignAutoSave({
  enabled,
  paused = false,
  interactionHold = false,
  productType,
  designId,
  saveDesign,
  onSaved,
  getFingerprint,
  getVisualFingerprint,
  buildRequest,
  debounceMs,
  mode = "explicit",
}: UseDesignAutoSaveOptions) {
  const [status, setStatus] = useState<DesignAutoSaveStatus>("idle");
  const designIdRef = useRef(designId);
  const productTypeRef = useRef(productType);
  const buildRequestRef = useRef(buildRequest);
  const getFingerprintRef = useRef(getFingerprint);
  const getVisualFingerprintRef = useRef(getVisualFingerprint);
  const onSavedRef = useRef(onSaved);
  const saveDesignRef = useRef(saveDesign);
  const baselineFingerprintRef = useRef<string | null>(null);
  const localDraftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  designIdRef.current = designId;
  productTypeRef.current = productType;
  buildRequestRef.current = buildRequest;
  getFingerprintRef.current = getFingerprint;
  getVisualFingerprintRef.current = getVisualFingerprint;
  onSavedRef.current = onSaved;
  saveDesignRef.current = saveDesign;

  const persistLocalDraft = useCallback(
    (fingerprint: string, build: DesignAutoSaveBuildFn) => {
      if (localDraftTimerRef.current) clearTimeout(localDraftTimerRef.current);
      localDraftTimerRef.current = setTimeout(() => {
        void (async () => {
          try {
            const request = await Promise.resolve(build({ includeThumbnail: false }));
            if (!request) return;
            await writeBuilderLocalDraft({
              productType: productTypeRef.current,
              designId: designIdRef.current,
              fingerprint,
              baselineFingerprint: baselineFingerprintRef.current,
              request,
            });
          } catch {
            // Local draft is best-effort.
          }
        })();
      }, LOCAL_DRAFT_DEBOUNCE_MS);
    },
    [],
  );

  const clearLocalDraft = useCallback(async () => {
    if (localDraftTimerRef.current) {
      clearTimeout(localDraftTimerRef.current);
      localDraftTimerRef.current = null;
    }
    await clearBuilderLocalDraft(builderDraftKey(productTypeRef.current, designIdRef.current));
    // Also clear the "new" slot when a designId appears after first save.
    if (designIdRef.current) {
      await clearBuilderLocalDraft(builderDraftKey(productTypeRef.current, null));
    }
  }, []);

  const controllerRef = useRef<DesignAutoSaveController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new DesignAutoSaveController({
      debounceMs,
      mode,
      onStatus: setStatus,
      onSaved: (summary) => {
        void clearBuilderLocalDraft(builderDraftKey(productTypeRef.current, summary.id));
        void clearBuilderLocalDraft(builderDraftKey(productTypeRef.current, null));
        onSavedRef.current?.(summary);
      },
      onDraftChange: ({ fingerprint, build }) => {
        persistLocalDraft(fingerprint, build);
      },
      getDesignId: () => designIdRef.current,
      save: (request, options) => saveDesignRef.current(request, options),
    });
  }

  const controller = controllerRef.current;

  useEffect(() => {
    controller.setPaused(paused || !enabled);
  }, [controller, paused, enabled]);

  useEffect(() => {
    controller.setInteractionHold(interactionHold);
  }, [controller, interactionHold]);

  useEffect(() => {
    return () => {
      controller.destroy();
      if (localDraftTimerRef.current) clearTimeout(localDraftTimerRef.current);
    };
  }, [controller]);

  const setBaseline = useCallback(
    (fingerprint: string, visualFingerprint?: string) => {
      baselineFingerprintRef.current = fingerprint;
      controller.setBaseline(fingerprint, visualFingerprint);
    },
    [controller],
  );

  const flush = useCallback(async () => {
    if (!enabled) return null;
    return controller.flush();
  }, [controller, enabled]);

  const fingerprint = enabled ? getFingerprint() : null;
  const visualFingerprint =
    enabled && getVisualFingerprint ? getVisualFingerprint() ?? fingerprint : fingerprint;

  useEffect(() => {
    if (!enabled || paused || !fingerprint || !visualFingerprint) return;
    controller.schedule(fingerprint, visualFingerprint, (ctx) => buildRequestRef.current(ctx));
  }, [controller, enabled, paused, fingerprint, visualFingerprint]);

  // Refresh offline/online status label only — never auto-save to the server.
  useEffect(() => {
    const onOnline = () => {
      if (!enabled || paused) return;
      if (controller.hasPendingChanges()) setStatus("pending");
      else if (baselineFingerprintRef.current) setStatus("saved");
    };
    const onOffline = () => {
      if (controller.hasPendingChanges()) setStatus("offline");
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [controller, enabled, paused]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!controller.hasPendingChanges()) return;
      event.preventDefault();
      event.returnValue = LEAVE_PAGE_WARNING;
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [controller]);

  const shouldBlock =
    enabled &&
    (status === "pending" || status === "saving" || status === "offline" || status === "error");
  const blocker = useBlocker(shouldBlock);
  const leaveOpen = blocker.state === "blocked";

  return {
    status,
    setBaseline,
    flush,
    hasPendingChanges: () => controller.hasPendingChanges(),
    clearLocalDraft,
    leaveGuard: (
      <BuilderUnsavedLeaveDialog
        open={leaveOpen}
        onStay={() => {
          if (blocker.state === "blocked") blocker.reset();
        }}
        onLeave={() => {
          if (blocker.state === "blocked") blocker.proceed();
        }}
      />
    ),
  };
}
