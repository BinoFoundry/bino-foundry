import { useCallback, useEffect, useMemo, useState } from "react";

import type { BraceletConfigurationPayload } from "@bino-foundry/shared/types";

import { useIsMobile } from "@/hooks/use-mobile";
import { useSiteGeneralSettings } from "@/hooks/use-site-settings";
import { type PlacedBead } from "@/lib/luxe-data";
import { useCatalogue } from "@/state/catalogue";
import type { BeadLibraryEntry } from "@/types/beads";
import type { BeadLibrarySizeOffer } from "@/types/bead-library-sizes";

import {
  getBeadAtIndex,
  insertBeadAt,
  insertBeadWithAutoLayout,
  normalizeFromSlots,
  normalizeSequence,
  removeBeadAt,
} from "../composition";
import {
  defaultSizeForLibrary,
  findSizeOffer,
  findSizeOfferByKey,
} from "../library-sizes";
import { buildBraceletPricing } from "../pricing";
import { movePlacedBead } from "../sequence-reorder";
import { serializeBraceletConfiguration } from "../serialize";
import { buildBraceletBuilderSummary } from "../summary";

function clampWristSize(value: number) {
  const clamped = Math.max(14, Math.min(20, value));
  return Math.round(clamped * 2) / 2;
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
  const isMobile = useIsMobile();
  const { beadTypes, beadLibrarySizes } = useCatalogue();
  const { data: siteSettings } = useSiteGeneralSettings();
  const currencyCode = siteSettings.currencyCode;

  const [wristSizeA, setWristSizeA] = useState(16);
  const [wristSizeB, setWristSizeB] = useState(16);
  const [placedBeadsA, setPlacedBeadsA] = useState<PlacedBead[]>([]);
  const [placedBeadsB, setPlacedBeadsB] = useState<PlacedBead[]>([]);
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

  const applySizeOffer = useCallback(
    (size: BeadLibrarySizeOffer) => {
      setSelectedSizeOfferKey(size.offerKey);
      if (!selectedStrandBead) return;

      const { bracelet, position } = selectedStrandBead;
      const placed = bracelet === "A" ? placedBeadsA : placedBeadsB;
      const setPlaced = bracelet === "A" ? setPlacedBeadsA : setPlacedBeadsB;
      const target = getBeadAtIndex(placed, position);
      if (!target) return;

      setPlaced(
        normalizeSequence(placed).map((b, i) =>
          i === position ? { ...b, size, bead: b.bead } : b,
        ),
      );
      bumpLayout();
    },
    [selectedStrandBead, placedBeadsA, placedBeadsB, bumpLayout],
  );

  const placeAt = useCallback(
    (
      bracelet: "A" | "B",
      position: number,
      bead: BeadLibraryEntry,
      size: BeadLibrarySizeOffer,
    ) => {
      const setPlaced = bracelet === "A" ? setPlacedBeadsA : setPlacedBeadsB;
      const placed = bracelet === "A" ? placedBeadsA : placedBeadsB;
      const newItem = buildPlacedBead(bead, size, position);
      setPlaced(insertBeadAt(placed, position, newItem));
      setSelectedStrandBead(null);
      bumpLayout();
      return true;
    },
    [placedBeadsA, placedBeadsB, bumpLayout],
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
      position: number,
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
      placeAt(bracelet, position, bead, size);
      setHoverSlot(null);
    },
    [beadLibrarySizes, activeSizeOffer, placeAt],
  );

  const handleBeadsReorder = useCallback(
    (bracelet: "A" | "B", fromPosition: number, toPosition: number) => {
      const setPlaced = bracelet === "A" ? setPlacedBeadsA : setPlacedBeadsB;
      setPlaced((prev) => movePlacedBead(prev, fromPosition, toPosition));
      bumpLayout();
    },
    [bumpLayout],
  );

  const handleRemoveBead = useCallback(
    (bracelet: "A" | "B", position: number) => {
      const setPlaced = bracelet === "A" ? setPlacedBeadsA : setPlacedBeadsB;
      setPlaced((prev) => removeBeadAt(prev, position));
      setSelectedStrandBead((sel) =>
        sel?.bracelet === bracelet && sel.position === position ? null : sel,
      );
      bumpLayout();
    },
    [bumpLayout],
  );

  const handleDuplicateBraceletToB = useCallback(() => {
    if (!twinning) return;
    setPlacedBeadsB(
      normalizeSequence(placedBeadsA).map((b) => ({
        position: b.position,
        bead: b.bead,
        size: b.size,
      })),
    );
    bumpLayout();
  }, [twinning, placedBeadsA, bumpLayout]);

  const autoPlaceItem = useCallback(
    (bead: BeadLibraryEntry, size: BeadLibrarySizeOffer) => {
      const item = buildPlacedBead(bead, size, 0);
      setPlacedBeadsA((prev) => insertBeadWithAutoLayout(prev, item));
      bumpLayout();
    },
    [bumpLayout],
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

      setSelectedBead(bead);
      setSelectedStrandBead(null);
      setSelectedSizeOfferKey(s.offerKey);
      if (!isMobile) autoPlaceItem(bead, s);
    },
    [
      beadLibrarySizes,
      isMobile,
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
    setSelectedBead(null);
    setSelectedStrandBead(null);
    setSelectedSizeOfferKey(null);
    setHoverSlot(null);
    bumpLayout();
  }, [bumpLayout]);

  const handleToggleTwinning = useCallback(() => {
    setTwinning((t) => {
      if (t) setPlacedBeadsB([]);
      return !t;
    });
    bumpLayout();
  }, [bumpLayout]);

  const setWristA = useCallback(
    (v: number) => {
      setWristSizeA(clampWristSize(v));
      bumpLayout();
    },
    [bumpLayout],
  );

  const setWristB = useCallback(
    (v: number) => {
      setWristSizeB(clampWristSize(v));
      bumpLayout();
    },
    [bumpLayout],
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

  return {
    wristSizeA,
    wristSizeB,
    setWristA,
    setWristB,
    selectedSizeOfferKey,
    setSelectedSizeOfferKey,
    activeSizeOffer,
    selectedStrandBead,
    setSelectedStrandBead,
    placedBeadsA,
    placedBeadsB,
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
    currencyCode,
  };
}
