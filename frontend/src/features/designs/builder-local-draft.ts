import type { DesignProductType, SaveDesignRequest } from "@bino-foundry/shared/types";

const DB_NAME = "bino-builder-drafts";
const DB_VERSION = 1;
const STORE = "drafts";

export type BuilderLocalDraft = {
  /** `${productType}:${designId ?? "new"}` */
  key: string;
  productType: DesignProductType;
  designId: string | null;
  fingerprint: string;
  /** Fingerprint of the last server-saved (or hydrated) baseline when the draft was written. */
  baselineFingerprint: string | null;
  updatedAt: number;
  /** Full design payload without thumbnail (thumbnails are regenerated on server save). */
  request: Omit<SaveDesignRequest, "previewThumbnailDataUrl">;
};

export function builderDraftKey(productType: DesignProductType, designId?: string | null): string {
  return `${productType}:${designId?.trim() || "new"}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("Failed to open draft DB"));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      const req = fn(store);
      req.onerror = () => reject(req.error ?? new Error("Draft store request failed"));
      req.onsuccess = () => resolve(req.result);
    });
  } finally {
    db.close();
  }
}

export async function putBuilderLocalDraft(draft: BuilderLocalDraft): Promise<void> {
  await withStore("readwrite", (store) => store.put(draft));
}

export async function getBuilderLocalDraft(key: string): Promise<BuilderLocalDraft | null> {
  try {
    const result = await withStore<BuilderLocalDraft | undefined>("readonly", (store) =>
      store.get(key),
    );
    return result ?? null;
  } catch {
    return null;
  }
}

export async function clearBuilderLocalDraft(key: string): Promise<void> {
  try {
    await withStore("readwrite", (store) => store.delete(key));
  } catch {
    // Best-effort cleanup.
  }
}

/** True when a stored draft has enough content to be worth restoring. */
export function draftHasRecoverableContent(draft: BuilderLocalDraft): boolean {
  const braceletItems = draft.request.bracelet?.items;
  if (Array.isArray(braceletItems) && braceletItems.length > 0) return true;
  if (draft.request.sunglasses?.frameId) return true;
  return false;
}

/** True when a stored draft differs from the last saved / currently loaded baseline. */
export function isRecoverableDraft(
  draft: BuilderLocalDraft | null | undefined,
  currentBaselineFingerprint: string | null,
): draft is BuilderLocalDraft {
  if (!draft?.fingerprint) return false;
  if (!draftHasRecoverableContent(draft)) return false;

  // Draft was written with no real delta vs its own baseline — nothing useful to restore.
  if (
    draft.baselineFingerprint != null &&
    draft.fingerprint === draft.baselineFingerprint
  ) {
    return false;
  }

  // Wait until the loaded design baseline is known so we do not prompt on plain page open.
  if (currentBaselineFingerprint == null) {
    return false;
  }

  // Already matches what's loaded — nothing to recover.
  if (draft.fingerprint === currentBaselineFingerprint) {
    return false;
  }

  return true;
}

export async function writeBuilderLocalDraft(input: {
  productType: DesignProductType;
  designId: string | null;
  fingerprint: string;
  baselineFingerprint: string | null;
  request: SaveDesignRequest;
}): Promise<void> {
  const { previewThumbnailDataUrl: _omit, ...request } = input.request;
  await putBuilderLocalDraft({
    key: builderDraftKey(input.productType, input.designId),
    productType: input.productType,
    designId: input.designId,
    fingerprint: input.fingerprint,
    baselineFingerprint: input.baselineFingerprint,
    updatedAt: Date.now(),
    request,
  });
}
