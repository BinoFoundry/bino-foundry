import type { SaveDesignRequest } from "@bino-foundry/shared/types";
import type { BraceletConfigurationPayload } from "@bino-foundry/shared/types";

/** Stable JSON key for comparing bracelet config payloads (excludes thumbnail). */
export function fingerprintBraceletConfig(
  bracelet: NonNullable<SaveDesignRequest["bracelet"]>,
  title?: string,
): string {
  return JSON.stringify({
    title: title?.trim() ?? "",
    twinning: bracelet.twinning,
    wristSizeCmA: bracelet.wristSizeCmA,
    wristSizeCmB: bracelet.wristSizeCmB,
    items: [...bracelet.items].sort(
      (a, b) =>
        a.strandIndex - b.strandIndex ||
        a.slotPosition - b.slotPosition ||
        a.beadLibraryId.localeCompare(b.beadLibraryId),
    ),
  });
}

export function fingerprintBraceletPayload(
  payload: Pick<
    BraceletConfigurationPayload,
    "twinning" | "wristSizeCmA" | "wristSizeCmB" | "items"
  >,
  title?: string,
): string {
  return fingerprintBraceletConfig(
    {
      twinning: payload.twinning,
      wristSizeCmA: payload.wristSizeCmA,
      wristSizeCmB: payload.wristSizeCmB,
      items: payload.items.map((item) => ({
        strandIndex: item.strandIndex,
        slotPosition: item.slotPosition,
        beadLibraryId: item.beadLibraryId,
        beadSizeMm: item.beadSizeMm,
      })),
    },
    title,
  );
}

/** Visual layout only — used to decide when to regenerate preview thumbnails. */
export function fingerprintBraceletVisual(
  payload: Pick<BraceletConfigurationPayload, "twinning" | "items">,
): string {
  return JSON.stringify({
    twinning: payload.twinning,
    items: [...payload.items].sort(
      (a, b) =>
        a.strandIndex - b.strandIndex ||
        a.slotPosition - b.slotPosition ||
        a.beadLibraryId.localeCompare(b.beadLibraryId) ||
        a.beadSizeMm - b.beadSizeMm,
    ),
  });
}

export function fingerprintSunglassesConfig(
  sunglasses: NonNullable<SaveDesignRequest["sunglasses"]>,
  title?: string,
): string {
  return JSON.stringify({
    title: title?.trim() ?? "",
    frameId: sunglasses.frameId,
    lensTintId: sunglasses.lensTintId,
    selectedOptions: sunglasses.selectedOptions,
    builderStep: sunglasses.builderStep ?? "",
    subtotal: sunglasses.subtotal ?? 0,
    currencyCode: sunglasses.currencyCode ?? "",
  });
}

export function fingerprintSunglassesVisual(
  sunglasses: Pick<
    NonNullable<SaveDesignRequest["sunglasses"]>,
    "frameId" | "lensTintId" | "selectedOptions"
  >,
): string {
  return JSON.stringify({
    frameId: sunglasses.frameId,
    lensTintId: sunglasses.lensTintId,
    selectedOptions: sunglasses.selectedOptions,
  });
}
