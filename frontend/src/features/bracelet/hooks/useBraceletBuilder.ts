import { useCallback, useEffect, useMemo, useState } from "react";

import type { BraceletConfigurationPayload } from "@bino-foundry/shared/types";

import { useIsMobile } from "@/hooks/use-mobile";
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
} from "../library-sizes";
import { buildBraceletPricing } from "../pricing";
import { swapPlacedBeads } from "../sequence-reorder";
import { STRAND_PATH_START_ANGLE } from "../strand-path";
import { serializeBraceletConfiguration } from "../serialize";
import { buildBraceletBuilderSummary } from "../summary";
import { buildPlacedFromSavedBracelet, type SavedBraceletLoadInput } from "../load-saved-bracelet";
import {
  activeWristSizes,
  catalogueWristSizeBounds,
  defaultWristSize,
  findWristSizeById,
} from "../wrist-sizes";

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
  const isMobile = useIsMobile();
  const { beadTypes, beadLibrarySizes, beadLibraries, wristSizes } = useCatalogue();
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
  const [layoutRevision, setLayoutRevision] = useState(0);
  const [hoverSlot, setHoverSlot] = useState<{ bracelet: "A" | "B"; position: number } | null>(null);

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
    const def = defaultSizeForLibrary(beadLibrarySizes, selectedBead.id);
    if (def && def.offerKey !== selectedSizeOfferKey) setSelectedSizeOfferKey(def.offerKey);
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

  const pricing = useMemo(
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
      ),
    [placedBeadsA, placedBeadsB, twinning, wristSizeA, wristSizeB, pricing],
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
      setSelectedStrandBead(null);
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

  const handleSlotClick = useCallback(
    (bracelet: "A" | "B", position: number) => {
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
      target: { mode: "insert" | "replace"; index: number; anchorAngleRad?: number },
      data: { bead?: BeadLibraryEntry; variantId?: string; sizeOfferKey?: string; beadSizeMm?: number },
    ) => {
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

      if (wasEmpty && target.anchorAngleRad !== undefined) {
        const setAnchor = bracelet === "A" ? setStrandAnchorAngleA : setStrandAnchorAngleB;
        setAnchor(target.anchorAngleRad);
      }

      placeAt(bracelet, target.index, bead, size);
      setHoverSlot(null);
    },
    [beadLibrarySizes, activeSizeOffer, placeAt, replaceAt, placedBeadsA, placedBeadsB],
  );

  const handleBeadsReorder = useCallback(
    (bracelet: "A" | "B", fromPosition: number, toPosition: number) => {
      const setPlaced = bracelet === "A" ? setPlacedBeadsA : setPlacedBeadsB;
      setPlaced((prev) => swapPlacedBeads(prev, fromPosition, toPosition));
    },
    [],
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

  const handleDuplicateBraceletToB = useCallback(() => {
    if (!twinning) return;
    if (!strandFitsOnWrist(wristSizeB, placedBeadsA)) {
      publishCapacityNotice(BRACELET_COPY.overCapacityBanner, "full");
      return;
    }
    setPlacedBeadsB(
      normalizeSequence(placedBeadsA).map((b) => ({
        position: b.position,
        bead: b.bead,
        size: b.size,
      })),
    );
    setStrandAnchorAngleB(strandAnchorAngleA);
    setCapacityNotice(null);
    bumpLayout();
  }, [twinning, placedBeadsA, wristSizeB, strandAnchorAngleA, bumpLayout, publishCapacityNotice]);

  const autoPlaceItem = useCallback(
    (bead: BeadLibraryEntry, size: BeadLibrarySizeOffer) => {
      if (!canPlaceBeadSize(wristSizeA, placedBeadsA, size.sizeMm)) {
        publishCapacityNotice(
          isStrandFull(wristSizeA, placedBeadsA)
            ? BRACELET_COPY.capacityFull
            : BRACELET_COPY.capacityBlocked(size.sizeMm),
          isStrandFull(wristSizeA, placedBeadsA) ? "full" : "blocked",
        );
        return false;
      }
      const item = buildPlacedBead(bead, size, 0);
      setPlacedBeadsA((prev) => insertBeadWithAutoLayout(prev, item));
      setCapacityNotice(null);
      bumpLayout();
      return true;
    },
    [bumpLayout, wristSizeA, placedBeadsA, publishCapacityNotice],
  );

  const handleSelectBead = useCallback(
    (bead: BeadLibraryEntry, size?: BeadLibrarySizeOffer) => {
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

      if (!isMobile && wristSizeConfirmed) {
        if (!autoPlaceItem(bead, s)) return;
        setSelectedBead(null);
        setSelectedStrandBead(null);
        setSelectedSizeOfferKey(null);
        return;
      }

      setSelectedBead(bead);
      setSelectedStrandBead(null);
      setSelectedSizeOfferKey(s.offerKey);
      if (wristSizeConfirmed && !canPlaceBeadSize(wristSizeA, placedBeadsA, s.sizeMm)) {
        publishCapacityNotice(
          isStrandFull(wristSizeA, placedBeadsA)
            ? BRACELET_COPY.capacityFull
            : BRACELET_COPY.capacityBlocked(s.sizeMm),
          isStrandFull(wristSizeA, placedBeadsA) ? "full" : "blocked",
        );
      }
    },
    [
      beadLibrarySizes,
      isMobile,
      wristSizeConfirmed,
      autoPlaceItem,
      selectedStrandBead,
      placedBeadsA,
      placedBeadsB,
      wristSizeA,
      applySizeOffer,
      publishCapacityNotice,
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
    bumpLayout();
  }, [bumpLayout, wristSizeConfirmed, wristSizeIdA, wristSizeIdB]);

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

  const canDuplicateToB = useMemo(
    () => strandFitsOnWrist(wristSizeB, placedBeadsA),
    [wristSizeB, placedBeadsA],
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
      ),
    [placedBeadsA, placedBeadsB, twinning, wristSizeA, wristSizeB, pricing],
  );

  const loadFromSaved = useCallback(
    (input: SavedBraceletLoadInput) => {
      const loaded = buildPlacedFromSavedBracelet(
        input,
        beadLibraries,
        beadLibrarySizes,
        wristSizes,
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
    [beadLibraries, beadLibrarySizes, wristSizes, bumpLayout],
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
    isStrandFullA,
    isStrandFullB,
    canDuplicateToB,
    capacityNotice,
    capacityNoticeVariant,
    setCapacityNotice,
    selectedSizeOfferKey,
    setSelectedSizeOfferKey,
    activeSizeOffer,
    selectedStrandBead,
    setSelectedStrandBead,
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
    handleSlotClick,
    handleBeadDrop,
    handleBeadsReorder,
    handleRemoveBead,
    handleDuplicateBraceletToB,
    handleSelectBead,
    handleReset,
    handleToggleTwinning,
    toSavedPayload,
    loadFromSaved,
    currencyCode,
  };
}
