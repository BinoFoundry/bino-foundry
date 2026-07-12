import { useCallback, useEffect, useRef, useState } from "react";

import type { SaveDesignRequest, SavedDesignSummary } from "@bino-foundry/shared/types";

import { LEAVE_PAGE_WARNING } from "./builder-save-copy";
import {
  DesignAutoSaveController,
  type DesignAutoSaveBuildContext,
  type DesignAutoSaveStatus,
} from "./design-autosave-controller";

export interface UseDesignAutoSaveOptions {
  enabled: boolean;
  paused?: boolean;
  /** When true, dirty state is tracked but saves wait until the interaction ends. */
  interactionHold?: boolean;
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
}

export function useDesignAutoSave({
  enabled,
  paused = false,
  interactionHold = false,
  designId,
  saveDesign,
  onSaved,
  getFingerprint,
  getVisualFingerprint,
  buildRequest,
  debounceMs,
}: UseDesignAutoSaveOptions) {
  const [status, setStatus] = useState<DesignAutoSaveStatus>("idle");
  const designIdRef = useRef(designId);
  const buildRequestRef = useRef(buildRequest);
  const getFingerprintRef = useRef(getFingerprint);
  const getVisualFingerprintRef = useRef(getVisualFingerprint);
  const onSavedRef = useRef(onSaved);
  const saveDesignRef = useRef(saveDesign);

  designIdRef.current = designId;
  buildRequestRef.current = buildRequest;
  getFingerprintRef.current = getFingerprint;
  getVisualFingerprintRef.current = getVisualFingerprint;
  onSavedRef.current = onSaved;
  saveDesignRef.current = saveDesign;

  const controllerRef = useRef<DesignAutoSaveController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new DesignAutoSaveController({
      debounceMs,
      onStatus: setStatus,
      onSaved: (summary) => onSavedRef.current?.(summary),
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
    return () => controller.destroy();
  }, [controller]);

  const setBaseline = useCallback(
    (fingerprint: string, visualFingerprint?: string) => {
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

  useEffect(() => {
    const onOnline = () => {
      if (!enabled || paused) return;
      const fp = getFingerprintRef.current();
      const visual = getVisualFingerprintRef.current?.() ?? fp;
      if (!fp || !visual) return;
      controller.schedule(fp, visual, (ctx) => buildRequestRef.current(ctx));
    };

    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
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

  return {
    status,
    setBaseline,
    flush,
    hasPendingChanges: () => controller.hasPendingChanges(),
  };
}
