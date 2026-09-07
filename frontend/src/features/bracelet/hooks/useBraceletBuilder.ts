import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { BraceletConfigurationPayload, BraceletPreparationSelection } from "@bino-foundry/shared/types";
import {
  applyPreparationPricing,
  resolvePreparationSelection,
} from "@bino-foundry/shared/how-we-prepare";

import { useSiteGeneralSettings } from "@/hooks/use-site-settings";
import { placedBeadSizeMm, type PlacedBead } from "@/lib/luxe-data";
import { useCatalogue } from "@/state/catalogue";
import type { BeadLibraryEntry } from "@/types/beads";
import type { BeadLibrarySizeOffer } from "@/types/bead-library-sizes";

import {
  canPlaceBeadSize,
  isStrandFull,
  strandFitsOnWrist,
  strandUsedMm,
  wristCircumferenceMm,
} from "../capacity";
import {
  getBeadAtIndex,
  removeBeadFrame,
  toggleBeadFlip,
  insertBeadAt,
  insertBeadWithAutoLayout,
  normalizeFromSlots,
  normalizeSequence,
  removeBeadAt,
  replaceBeadAt,
} from "../composition";
import { BRACELET_COPY } from "../copy";
import {
  defaultSizeForLibrary,
  findSizeOffer,
  findSizeOfferByKey,
  resolveSelectedSizeOfferKey,
} from "../library-sizes";
import { buildBraceletPricing } from "../pricing";
import { swapPlacedBeads, logBraceletReorderSwap } from "../sequence-reorder";
import { STRAND_PATH_START_ANGLE } from "../strand-path";
import { serializeBraceletConfiguration } from "../serialize";
import { buildBraceletBuilderSummary } from "../summary";
import { buildPlacedFromSavedBracelet, type SavedBraceletLoadInput } from "../load-saved-bracelet";
import { resolveAutoPlacementStrand, isMatchingPairMatched } from "../matching-pair-placement";
import { strandHasUnavailableBeads } from "../unavailable-bead";
import {
  activeWristSizes,
  catalogueWristSizeBounds,
  defaultWristSize,
  findWristSizeById,
} from "../wrist-sizes";

function copyPlacedBeads(source: PlacedBead[]): PlacedBead[] {
  return normalizeSequence(source).map((bead) => ({
    position: bead.position,
    bead: bead.bead,
    size: { ...bead.size },
  }));
}

function buildPlacedBead(
  bead: BeadLibraryEntry,
  size: BeadLibrarySizeOffer,
  position: number,
): PlacedBead {
  return { position, bead, size };
}

export interface SelectedStrandBead {
  bracelet: "A" | "B";
  position: number;
}

export interface UseBraceletBuilderOptions {
  onPriceChange?: (total: number) => void;
}

export function useBraceletBuilder(options: UseBraceletBuilderOptions = {}) {
  const { onPriceChange } = options;
  const { beadTypes, beadLibrarySizes, beadLibraries, beadAvailabilityStatuses, wristSizes, howWePrepareOptions } =
    useCatalogue();
  const { data: siteSettings } = useSiteGeneralSettings();
  const currencyCode = siteSettings.currencyCode;

  const activeWristOptions = useMemo(() => activeWristSizes(wristSizes), [wristSizes]);
  const fallbackWrist = useMemo(() => defaultWristSize(wristSizes), [wristSizes]);
  const wristSizeBounds = useMemo(() => catalogueWristSizeBounds(wristSizes), [wristSizes]);

  const [wristSizeIdA, setWristSizeIdA] = useState<string | null>(null);
  const [wristSizeIdB, setWristSizeIdB] = useState<string | null>(null);
  const [draftWristIdA, setDraftWristIdA] = useState<string | null>(null);
  const [draftWristIdB, setDraftWristIdB] = useState<string | null>(null);
  const [wristSizeConfirmed, setWristSizeConfirmed] = useState(false);
  const [capacityNotice, setCapacityNotice] = useState<string | null>(null);
  const [capacityNoticeVariant, setCapacityNoticeVariant] = useState<"blocked" | "full">("blocked");

  const publishCapacityNotice = useCallback((message: string, variant: "blocked" | "full" = "blocked") => {
    setCapacityNotice(message);
    setCapacityNoticeVariant(variant);
  }, []);

  useEffect(() => {
    if (!capacityNotice) return;
    const timer = window.setTimeout(() => setCapacityNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [capacityNotice]);

  const wristSizeA = useMemo(() => {
    const entry = findWristSizeById(wristSizes, wristSizeIdA ?? "");
    return entry?.sizeCm ?? fallbackWrist?.sizeCm ?? 0;
  }, [wristSizes, wristSizeIdA, fallbackWrist]);

  const wristSizeB = useMemo(() => {
    const entry = findWristSizeById(wristSizes, wristSizeIdB ?? "");
    return entry?.sizeCm ?? wristSizeA;
  }, [wristSizes, wristSizeIdB, wristSizeA]);

  const [placedBeadsA, setPlacedBeadsA] = useState<PlacedBead[]>([]);
  const [placedBeadsB, setPlacedBeadsB] = useState<PlacedBead[]>([]);
  const [strandAnchorAngleA, setStrandAnchorAngleA] = useState(STRAND_PATH_START_ANGLE);
  const [strandAnchorAngleB, setStrandAnchorAngleB] = useState(STRAND_PATH_START_ANGLE);
  const [twinning, setTwinning] = useState(false);
  const [selectedBead, setSelectedBead] = useState<BeadLibraryEntry | null>(null);
  const [selectedSizeOfferKey, setSelectedSizeOfferKey] = useState<string | null>(null);
  const [selectedStrandBead, setSelectedStrandBead] = useState<SelectedStrandBead | null>(null);
  /** Strand that receives library click inserts when matching pair is on. */
  const [activePlacementStrand, setActivePlacementStrand] = useState<"A" | "B">("A");
  const [layoutRevision, setLayoutRevision] = useState(0);
  const [hoverSlot, setHoverSlot] = useState<{ bracelet: "A" | "B"; position: number } | null>(null);
  const [preparationSelection, setPreparationSelection] = useState<BraceletPreparationSelection | null>(null);

  const bumpLayout = useCallback(() => setLayoutRevision((n) => n + 1), []);

  const activeSizeOffer = useMemo(
    () =>
      selectedSizeOfferKey
        ? findSizeOfferByKey(beadLibrarySizes, selectedSizeOfferKey)
        : undefined,
    [beadLibrarySizes, selectedSizeOfferKey],
  );

  useEffect(() => {
    if (!selectedBead || selectedStrandBead) return;
    const nextKey = resolveSelectedSizeOfferKey(
      beadLibrarySizes,
      selectedBead.id,
      selectedSizeOfferKey,
    );
    if (nextKey && nextKey !== selectedSizeOfferKey) setSelectedSizeOfferKey(nextKey);
  }, [selectedBead, selectedStrandBead, beadLibrarySizes, selectedSizeOfferKey]);

  useEffect(() => {
    if (!selectedStrandBead) return;
    const placed =
      selectedStrandBead.bracelet === "A" ? placedBeadsA : placedBeadsB;
    const item = getBeadAtIndex(placed, selectedStrandBead.position);
    if (item && item.size.offerKey !== selectedSizeOfferKey) {
      setSelectedSizeOfferKey(item.size.offerKey);
    }
  }, [selectedStrandBead, placedBeadsA, placedBeadsB, selectedSizeOfferKey]);

  const activeHowWePrepareOptions = useMemo(
    () =>
      howWePrepareOptions
        .filter((o) => o.status === "active")
        .sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug)),
    [howWePrepareOptions],
  );

  useEffect(() => {
    setPreparationSelection((prev) =>
      resolvePreparationSelection(activeHowWePrepareOptions, prev),
    );
  }, [activeHowWePrepareOptions]);

  const basePricing = useMemo(
    () =>
      buildBraceletPricing(
        placedBeadsA,
        placedBeadsB,
        twinning,
        wristSizeA,
        wristSizeB,
        beadTypes,
        currencyCode,
        beadLibrarySizes,
      ),
    [
      placedBeadsA,
      placedBeadsB,
      twinning,
      wristSizeA,
      wristSizeB,
      beadTypes,
      currencyCode,
      beadLibrarySizes,
    ],
  );

  const preparationPricing = useMemo(
    () =>
      applyPreparationPricing({
        beadSubtotal: basePricing.subtotal,
        twinning,
        options: activeHowWePrepareOptions,
        selection: preparationSelection,
      }),
    [basePricing.subtotal, twinning, activeHowWePrepareOptions, preparationSelection],
  );

  const pricing = useMemo(
    () => ({
      ...basePricing,
      preparationLineItem: preparationPricing.preparationLineItem,
      preparationSubtotal: preparationPricing.preparationSubtotal,
      total: preparationPricing.total,
    }),
    [basePricing, preparationPricing],
  );

  const selectPreparation = useCallback(
    (slug: string) => {
      const option = activeHowWePrepareOptions.find((o) => o.slug === slug);
      if (!option) return;
      setPreparationSelection({
        optionSlug: slug,
        quantity: option.quantityEnabled ? option.defaultQuantity : 1,
      });
    },
    [activeHowWePrepareOptions],
  );

  const setPreparationQuantity = useCallback(
    (quantity: number) => {
      setPreparationSelection((prev) => {
        if (!prev) return prev;
        const option = activeHowWePrepareOptions.find((o) => o.slug === prev.optionSlug);
        if (!option?.quantityEnabled) return prev;
        const nextQty = Math.min(
          option.maximumQuantity,
          Math.max(option.minimumQuantity, quantity),
        );
        if (nextQty === prev.quantity) return prev;
        return { ...prev, quantity: nextQty };
      });
    },
    [activeHowWePrepareOptions],
  );

  const summary = useMemo(
    () =>
      buildBraceletBuilderSummary(
        placedBeadsA,
        placedBeadsB,
        twinning,
        wristSizeA,
        wristSizeB,
        selectedSizeOfferKey,
        activeSizeOffer?.label,
        pricing,
        beadTypes,
      ),
    [
      placedBeadsA,
      placedBeadsB,
      twinning,
      wristSizeA,
      wristSizeB,
      selectedSizeOfferKey,
      activeSizeOffer?.label,
      pricing,
      beadTypes,
    ],
  );

  const configuration = useMemo(
    () =>
      serializeBraceletConfiguration(
        placedBeadsA,
        placedBeadsB,
        twinning,
        wristSizeA,
        wristSizeB,
        pricing,
        "draft",
        preparationSelection,
      ),
    [placedBeadsA, placedBeadsB, twinning, wristSizeA, wristSizeB, pricing, preparationSelection],
  );

  useEffect(() => {
    onPriceChange?.(pricing.total);
  }, [pricing.total, onPriceChange]);

  const wristCmFor = useCallback(
    (bracelet: "A" | "B") => (bracelet === "A" ? wristSizeA : wristSizeB),
    [wristSizeA, wristSizeB],
  );

  const applySizeOffer = useCallback(
    (size: BeadLibrarySizeOffer) => {
      setSelectedSizeOfferKey(size.offerKey);
      if (!selectedStrandBead) return;

      const { bracelet, position } = selectedStrandBead;
      const placed = bracelet === "A" ? placedBeadsA : placedBeadsB;
      const setPlaced = bracelet === "A" ? setPlacedBeadsA : setPlacedBeadsB;
      const target = getBeadAtIndex(placed, position);
      if (!target) return;

      const wristCm = wristCmFor(bracelet);
      const usedWithout = strandUsedMm(placed) - placedBeadSizeMm(target);
      if (usedWithout + size.sizeMm > wristCircumferenceMm(wristCm)) {
        publishCapacityNotice(BRACELET_COPY.capacityBlocked(size.sizeMm));
        return;
      }

      setCapacityNotice(null);
      setPlaced(
        normalizeSequence(placed).map((b, i) =>
          i === position ? { ...b, size, bead: b.bead } : b,
        ),
      );
      bumpLayout();
    },
    [selectedStrandBead, placedBeadsA, placedBeadsB, bumpLayout, wristCmFor, publishCapacityNotice],
  );

  const placeAt = useCallback(
    (
      bracelet: "A" | "B",
      position: number,
      bead: BeadLibraryEntry,
      size: BeadLibrarySizeOffer,
    ) => {
      const placed = bracelet === "A" ? placedBeadsA : placedBeadsB;
      const wristCm = wristCmFor(bracelet);
      if (!canPlaceBeadSize(wristCm, placed, size.sizeMm)) {
        publishCapacityNotice(
          isStrandFull(wristCm, placed)
            ? BRACELET_COPY.capacityFull
            : BRACELET_COPY.capacityBlocked(size.sizeMm),
          isStrandFull(wristCm, placed) ? "full" : "blocked",
        );
        return false;
      }

      const setPlaced = bracelet === "A" ? setPlacedBeadsA : setPlacedBeadsB;
      const newItem = buildPlacedBead(bead, size, position);
      setPlaced(insertBeadAt(placed, position, newItem));
      setSelectedBead(null);
      setSelectedStrandBead(null);
      setSelectedSizeOfferKey(null);
      setCapacityNotice(null);
      bumpLayout();
      return true;
    },
    [placedBeadsA, placedBeadsB, bumpLayout, wristCmFor, publishCapacityNotice],
  );

  const replaceAt = useCallback(
    (
      bracelet: "A" | "B",
      position: number,
      bead: BeadLibraryEntry,
      size: BeadLibrarySizeOffer,
    ) => {
      const placed = bracelet === "A" ? placedBeadsA : placedBeadsB;
      const target = getBeadAtIndex(placed, position);
      if (!target) return placeAt(bracelet, position, bead, size);

      const wristCm = wristCmFor(bracelet);
      const usedWithout = strandUsedMm(placed) - placedBeadSizeMm(target);
      if (usedWithout + size.sizeMm > wristCircumferenceMm(wristCm)) {
        publishCapacityNotice(BRACELET_COPY.capacityBlocked(size.sizeMm));
        return false;
      }

      const setPlaced = bracelet === "A" ? setPlacedBeadsA : setPlacedBeadsB;
      const newItem = buildPlacedBead(bead, size, position);
      setPlaced(replaceBeadAt(placed, position, newItem));
      setSelectedStrandBead(null);
      setCapacityNotice(null);
      bumpLayout();
      return true;
    },
    [placedBeadsA, placedBeadsB, placeAt, bumpLayout, wristCmFor, publishCapacityNotice],
  );

  /**
   * Attach a halo to the bead at `index`, replacing any halo already there.
   *
   * A frame wraps its bead instead of taking a slot, so it adds nothing to the
   * strand length — there is deliberately no capacity check here.
   */
  const frameAt = useCallback(
    (
      bracelet: "A" | "B",
      index: number,
      bead: BeadLibraryEntry,
      size: BeadLibrarySizeOffer,
    ) => {
      const setPlaced = bracelet === "A" ? setPlacedBeadsA : setPlacedBeadsB;
      setPlaced((prev) => {
        const target = getBeadAtIndex(prev, index);
        if (!target) return prev;
        return replaceBeadAt(prev, index, { ...target, frame: { bead, size } });
      });
      setCapacityNotice(null);
      bumpLayout();
    },
    [bumpLayout],
  );

  /** Turn an asymmetric piece around — which bead a cap faces is the
   * customer's call, not something the strand can work out. */
  const handleToggleFlip = useCallback(
    (bracelet: "A" | "B", position: number) => {
      const setPlaced = bracelet === "A" ? setPlacedBeadsA : setPlacedBeadsB;
      setPlaced((prev) => toggleBeadFlip(prev, position));
      bumpLayout();
    },
    [bumpLayout],
  );

  /** Take the halo off a bead, leaving the bead itself in place. */
  const handleRemoveFrame = useCallback(
    (bracelet: "A" | "B", position: number) => {
      const setPlaced = bracelet === "A" ? setPlacedBeadsA : setPlacedBeadsB;
      setPlaced((prev) => removeBeadFrame(prev, position));
      bumpLayout();
    },
    [bumpLayout],
  );

  const handleSlotClick = useCallback(
    (bracelet: "A" | "B", position: number) => {
      setActivePlacementStrand(bracelet);
      const placed = bracelet === "A" ? placedBeadsA : placedBeadsB;
      const sorted = normalizeFromSlots(placed);
      const existing = getBeadAtIndex(placed, position);
      const isEmptyStrand = sorted.length === 0;
      const isInsertionSlot = !existing && (isEmptyStrand || position === sorted.length);
      const insertIndex = isEmptyStrand ? 0 : position;

      if (existing && !selectedBead) {
        if (
          selectedStrandBead?.bracelet === bracelet &&
          selectedStrandBead.position === position
        ) {
          const setPlaced = bracelet === "A" ? setPlacedBeadsA : setPlacedBeadsB;
          setPlaced(removeBeadAt(placed, position));
          setSelectedStrandBead(null);
          bumpLayout();
          return { openLibrary: false as const };
        }
        setSelectedStrandBead({ bracelet, position });
        return { openLibrary: false as const };
      }

      if (selectedBead && activeSizeOffer && isInsertionSlot) {
        placeAt(bracelet, insertIndex, selectedBead, activeSizeOffer);
      } else if (isInsertionSlot) {
        return { openLibrary: true as const };
      }

      return { openLibrary: false as const };
    },
    [
      placedBeadsA,
      placedBeadsB,
      selectedBead,
      selectedStrandBead,
      activeSizeOffer,
      placeAt,
      bumpLayout,
    ],
  );

  const handleBeadDrop = useCallback(
    (
      bracelet: "A" | "B",
      target: { mode: "insert" | "replace" | "frame"; index: number; anchorAngleRad?: number },
      data: { bead?: BeadLibraryEntry; variantId?: string; sizeOfferKey?: string; beadSizeMm?: number },
    ) => {
      setActivePlacementStrand(bracelet);
      const bead = data?.bead;
      if (!bead) return;
      const size =
        (data.sizeOfferKey && findSizeOfferByKey(beadLibrarySizes, data.sizeOfferKey)) ||
        (data.variantId && findSizeOfferByKey(beadLibrarySizes, data.variantId)) ||
        (data.beadSizeMm !== undefined && findSizeOffer(beadLibrarySizes, bead.id, data.beadSizeMm)) ||
        (activeSizeOffer && activeSizeOffer.beadLibraryId === bead.id ? activeSizeOffer : undefined) ||
        defaultSizeForLibrary(beadLibrarySizes, bead.id);
      if (!size) return;

      const placed = bracelet === "A" ? placedBeadsA : placedBeadsB;
      const wasEmpty = normalizeFromSlots(placed).length === 0;

      if (target.mode === "replace") {
        replaceAt(bracelet, target.index, bead, size);
        return;
      }

      // index -1 means the frame was released in open space, not over a bead:
      // there is nothing to wrap, so the drop is simply ignored.
      if (target.mode === "frame") {
        if (target.index >= 0) frameAt(bracelet, target.index, bead, size);
        setHoverSlot(null);
        return;
      }

      if (wasEmpty && target.anchorAngleRad !== undefined) {
        const setAnchor = bracelet === "A" ? setStrandAnchorAngleA : setStrandAnchorAngleB;
        setAnchor(target.anchorAngleRad);
      }

      placeAt(bracelet, target.index, bead, size);
      setHoverSlot(null);
    },
    [beadLibrarySizes, activeSizeOffer, placeAt, replaceAt, frameAt, placedBeadsA, placedBeadsB],
  );

  const handleBeadsReorder = useCallback(
    (bracelet: "A" | "B", fromPosition: number, toPosition: number) => {
      const setPlaced = bracelet === "A" ? setPlacedBeadsA : setPlacedBeadsB;
      setPlaced((prev) => {
        const next = swapPlacedBeads(prev, fromPosition, toPosition);
        logBraceletReorderSwap(prev, fromPosition, toPosition, next);
        return next;
      });
      bumpLayout();
    },
    [bumpLayout],
  );

  const handleRemoveBead = useCallback(
    (bracelet: "A" | "B", position: number) => {
      const setPlaced = bracelet === "A" ? setPlacedBeadsA : setPlacedBeadsB;
      const setAnchor = bracelet === "A" ? setStrandAnchorAngleA : setStrandAnchorAngleB;
      setPlaced((prev) => {
        const next = removeBeadAt(prev, position);
        if (normalizeFromSlots(next).length === 0) {
          setAnchor(STRAND_PATH_START_ANGLE);
        }
        setCapacityNotice(null);
        return next;
      });
      setSelectedStrandBead((sel) =>
        sel?.bracelet === bracelet && sel.position === position ? null : sel,
      );
      bumpLayout();
    },
    [bumpLayout],
  );

  const handleMatchBracelets = useCallback(() => {
    if (!twinning) return;
    if (normalizeFromSlots(placedBeadsA).length === 0) return;
    if (!strandFitsOnWrist(wristSizeB, placedBeadsA)) {
      publishCapacityNotice(BRACELET_COPY.overCapacityBanner, "full");
      return;
    }
    setPlacedBeadsB(copyPlacedBeads(placedBeadsA));
    setStrandAnchorAngleB(strandAnchorAngleA);
    setCapacityNotice(null);
    setSelectedStrandBead((sel) => (sel?.bracelet === "B" ? null : sel));
    bumpLayout();
    toast.success(BRACELET_COPY.matchBraceletsSuccess);
  }, [twinning, placedBeadsA, wristSizeB, strandAnchorAngleA, bumpLayout, publishCapacityNotice]);

  const handleUnmatchBracelets = useCallback(() => {
    if (!twinning) return;
    setPlacedBeadsB([]);
    setStrandAnchorAngleB(STRAND_PATH_START_ANGLE);
    setSelectedStrandBead((sel) => (sel?.bracelet === "B" ? null : sel));
    setCapacityNotice(null);
    bumpLayout();
    toast.success(BRACELET_COPY.unmatchBraceletsSuccess);
  }, [twinning, bumpLayout]);

  const autoPlaceItem = useCallback(
    (
      bead: BeadLibraryEntry,
      size: BeadLibrarySizeOffer,
      preferredStrand?: "A" | "B",
    ) => {
      const preferred = preferredStrand ?? (twinning ? activePlacementStrand : "A");
      const target = resolveAutoPlacementStrand({
        twinning,
        wristSizeA,
        wristSizeB,
        placedA: placedBeadsA,
        placedB: placedBeadsB,
        beadSizeMm: size.sizeMm,
        preferredStrand: preferred,
      });

      if (!target) {
        const aFull = !canPlaceBeadSize(wristSizeA, placedBeadsA, size.sizeMm);
        publishCapacityNotice(
          twinning && aFull && !canPlaceBeadSize(wristSizeB, placedBeadsB, size.sizeMm)
            ? BRACELET_COPY.capacityFull
            : isStrandFull(wristSizeA, placedBeadsA)
              ? BRACELET_COPY.capacityFull
              : BRACELET_COPY.capacityBlocked(size.sizeMm),
          "full",
        );
        return false;
      }

      const item = buildPlacedBead(bead, size, 0);
      if (target === "A") {
        setPlacedBeadsA((prev) => insertBeadWithAutoLayout(prev, item));
      } else {
        setPlacedBeadsB((prev) => insertBeadWithAutoLayout(prev, item));
      }
      setActivePlacementStrand(target);
      setCapacityNotice(null);
      bumpLayout();
      return true;
    },
    [
      bumpLayout,
      twinning,
      wristSizeA,
      wristSizeB,
      placedBeadsA,
      placedBeadsB,
      activePlacementStrand,
      publishCapacityNotice,
    ],
  );

  const handleSelectBead = useCallback(
    (
      bead: BeadLibraryEntry,
      size?: BeadLibrarySizeOffer,
      preferredStrand?: "A" | "B",
    ) => {
      const s = size ?? defaultSizeForLibrary(beadLibrarySizes, bead.id);
      if (!s) return;

      if (selectedStrandBead) {
        const placed =
          selectedStrandBead.bracelet === "A" ? placedBeadsA : placedBeadsB;
        const target = getBeadAtIndex(placed, selectedStrandBead.position);
        if (target?.bead.id === bead.id) {
          applySizeOffer(s);
          return;
        }
      }

      if (wristSizeConfirmed) {
        if (!autoPlaceItem(bead, s, preferredStrand)) return;
        setSelectedBead(null);
        setSelectedStrandBead(null);
        setSelectedSizeOfferKey(null);
        return;
      }

      setSelectedBead(bead);
      setSelectedStrandBead(null);
      setSelectedSizeOfferKey(s.offerKey);
    },
    [
      beadLibrarySizes,
      wristSizeConfirmed,
      autoPlaceItem,
      selectedStrandBead,
      placedBeadsA,
      placedBeadsB,
      applySizeOffer,
    ],
  );

  const handleReset = useCallback(() => {
    setPlacedBeadsA([]);
    setPlacedBeadsB([]);
    setStrandAnchorAngleA(STRAND_PATH_START_ANGLE);
    setStrandAnchorAngleB(STRAND_PATH_START_ANGLE);
    setSelectedBead(null);
    setSelectedStrandBead(null);
    setSelectedSizeOfferKey(null);
    setHoverSlot(null);
    setCapacityNotice(null);
    bumpLayout();
  }, [bumpLayout]);

  const handleToggleTwinning = useCallback(() => {
    setTwinning((t) => {
      if (t) {
        setPlacedBeadsB([]);
        return false;
      }
      if (wristSizeConfirmed && wristSizeIdA && !wristSizeIdB) {
        setWristSizeIdB(wristSizeIdA);
        setDraftWristIdB(wristSizeIdA);
      }
      return true;
    });
  }, [wristSizeConfirmed, wristSizeIdA, wristSizeIdB]);

  const selectDraftWristA = useCallback((entry: { id: string }) => {
    setDraftWristIdA(entry.id);
  }, []);

  const selectDraftWristB = useCallback((entry: { id: string }) => {
    setDraftWristIdB(entry.id);
  }, []);

  const confirmWristSizes = useCallback(() => {
    if (!draftWristIdA) return;
    setWristSizeIdA(draftWristIdA);
    setWristSizeIdB(twinning ? (draftWristIdB ?? draftWristIdA) : draftWristIdA);
    setWristSizeConfirmed(true);
    setCapacityNotice(null);
    bumpLayout();
  }, [draftWristIdA, draftWristIdB, twinning, bumpLayout]);

  const setWristA = useCallback(
    (entry: { id: string; sizeCm: number }) => {
      setWristSizeIdA(entry.id);
      setDraftWristIdA(entry.id);
      const fits = strandFitsOnWrist(entry.sizeCm, placedBeadsA);
      if (!fits) {
        publishCapacityNotice(BRACELET_COPY.wristChangeOverCapacity, "full");
      } else {
        setCapacityNotice(null);
      }
      bumpLayout();
    },
    [bumpLayout, placedBeadsA, publishCapacityNotice],
  );

  const setWristB = useCallback(
    (entry: { id: string; sizeCm: number }) => {
      setWristSizeIdB(entry.id);
      setDraftWristIdB(entry.id);
      const fits = strandFitsOnWrist(entry.sizeCm, placedBeadsB);
      if (!fits) {
        publishCapacityNotice(BRACELET_COPY.wristChangeOverCapacity, "full");
      } else if (!pricing.strandFit.strandA.isOverCapacity) {
        setCapacityNotice(null);
      }
      bumpLayout();
    },
    [bumpLayout, placedBeadsB, pricing.strandFit.strandA.isOverCapacity, publishCapacityNotice],
  );

  const isOverCapacity = useMemo(() => {
    const overA = pricing.strandFit.strandA.isOverCapacity;
    const overB = twinning && pricing.strandFit.strandB?.isOverCapacity;
    return Boolean(overA || overB);
  }, [pricing.strandFit, twinning]);

  const isStrandFullA = useMemo(
    () => isStrandFull(wristSizeA, placedBeadsA),
    [wristSizeA, placedBeadsA],
  );

  const isStrandFullB = useMemo(
    () => twinning && isStrandFull(wristSizeB, placedBeadsB),
    [twinning, wristSizeB, placedBeadsB],
  );

  const canMatchBracelets = useMemo(
    () =>
      normalizeFromSlots(placedBeadsA).length > 0 && strandFitsOnWrist(wristSizeB, placedBeadsA),
    [wristSizeB, placedBeadsA],
  );

  const braceletBMatched = useMemo(
    () => isMatchingPairMatched(placedBeadsB),
    [placedBeadsB],
  );

  const toSavedPayload = useCallback(
    (status: BraceletConfigurationPayload["status"] = "saved") =>
      serializeBraceletConfiguration(
        placedBeadsA,
        placedBeadsB,
        twinning,
        wristSizeA,
        wristSizeB,
        pricing,
        status,
        preparationSelection,
      ),
    [placedBeadsA, placedBeadsB, twinning, wristSizeA, wristSizeB, pricing, preparationSelection],
  );

  const hasUnavailableBeads = useMemo(
    () => strandHasUnavailableBeads(placedBeadsA, placedBeadsB),
    [placedBeadsA, placedBeadsB],
  );

  const loadFromSaved = useCallback(
    (input: SavedBraceletLoadInput) => {
      const loaded = buildPlacedFromSavedBracelet(
        input,
        beadLibraries,
        beadLibrarySizes,
        wristSizes,
        beadAvailabilityStatuses,
      );
      setTwinning(loaded.twinning);
      setWristSizeIdA(loaded.wristSizeIdA);
      setWristSizeIdB(loaded.wristSizeIdB);
      setDraftWristIdA(loaded.wristSizeIdA);
      setDraftWristIdB(loaded.wristSizeIdB);
      setWristSizeConfirmed(true);
      setPlacedBeadsA(loaded.placedBeadsA);
      setPlacedBeadsB(loaded.placedBeadsB);
      setStrandAnchorAngleA(STRAND_PATH_START_ANGLE);
      setStrandAnchorAngleB(STRAND_PATH_START_ANGLE);
      setCapacityNotice(null);
      bumpLayout();
    },
    [beadLibraries, beadLibrarySizes, wristSizes, beadAvailabilityStatuses, bumpLayout],
  );

  return {
    wristSizes: activeWristOptions,
    wristSizeBounds,
    wristSizeA,
    wristSizeB,
    wristSizeIdA,
    wristSizeIdB,
    draftWristIdA,
    draftWristIdB,
    wristSizeConfirmed,
    confirmWristSizes,
    selectDraftWristA,
    selectDraftWristB,
    setWristA,
    setWristB,
    isOverCapacity,
    hasUnavailableBeads,
    isStrandFullA,
    isStrandFullB,
    canMatchBracelets,
    braceletBMatched,
    capacityNotice,
    capacityNoticeVariant,
    setCapacityNotice,
    selectedSizeOfferKey,
    setSelectedSizeOfferKey,
    activeSizeOffer,
    selectedStrandBead,
    setSelectedStrandBead,
    activePlacementStrand,
    setActivePlacementStrand,
    placedBeadsA,
    placedBeadsB,
    strandAnchorAngleA,
    strandAnchorAngleB,
    twinning,
    selectedBead,
    setSelectedBead,
    strandFitA: pricing.strandFit.strandA,
    strandFitB: pricing.strandFit.strandB,
    hoverSlot,
    setHoverSlot,
    layoutRevision,
    pricing,
    summary,
    configuration,
    howWePrepareOptions: activeHowWePrepareOptions,
    preparationSelection,
    selectPreparation,
    setPreparationQuantity,
    handleSlotClick,
    handleBeadDrop,
    handleBeadsReorder,
    handleRemoveBead,
    handleRemoveFrame,
    handleToggleFlip,
    handleMatchBracelets,
    handleUnmatchBracelets,
    handleSelectBead,
    handleReset,
    handleToggleTwinning,
    toSavedPayload,
    loadFromSaved,
    currencyCode,
  };
}
