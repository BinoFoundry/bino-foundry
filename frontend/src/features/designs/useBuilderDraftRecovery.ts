import type { DesignProductType } from "@bino-foundry/shared/types";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  builderDraftKey,
  clearBuilderLocalDraft,
  getBuilderLocalDraft,
  isRecoverableDraft,
  type BuilderLocalDraft,
} from "./builder-local-draft";

export type UseBuilderDraftRecoveryOptions = {
  productType: DesignProductType;
  designId: string | null;
  /** Wait until server/URL hydration finishes before checking IndexedDB. */
  hydrationDone: boolean;
  /** Current baseline fingerprint after hydration (or null if empty builder). */
  baselineFingerprint: string | null;
};

/**
 * After hydration, offer to restore a local draft that differs from the loaded baseline.
 */
export function useBuilderDraftRecovery({
  productType,
  designId,
  hydrationDone,
  baselineFingerprint,
}: UseBuilderDraftRecoveryOptions) {
  const [draft, setDraft] = useState<BuilderLocalDraft | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const checkedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hydrationDone) return;
    const key = builderDraftKey(productType, designId);
    if (checkedRef.current === key) return;
    checkedRef.current = key;

    let cancelled = false;
    void (async () => {
      const keys = designId ? [key, builderDraftKey(productType, null)] : [key];

      for (const k of keys) {
        const stored = await getBuilderLocalDraft(k);
        if (cancelled) return;
        if (isRecoverableDraft(stored, baselineFingerprint)) {
          setDraft(stored);
          setPromptOpen(true);
          return;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrationDone, productType, designId, baselineFingerprint]);

  const discardDraft = useCallback(() => {
    setPromptOpen(false);
    if (draft) {
      void clearBuilderLocalDraft(draft.key);
    }
    setDraft(null);
  }, [draft]);

  const takeDraftForRestore = useCallback((): BuilderLocalDraft | null => {
    setPromptOpen(false);
    const next = draft;
    setDraft(null);
    return next;
  }, [draft]);

  return {
    recoveryDraft: draft,
    recoveryOpen: promptOpen,
    takeDraftForRestore,
    discardDraft,
  };
}
