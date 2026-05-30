import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DEFAULT_BRACELET_PRICING_RULES,
  type BraceletConfigurationPayload,
  type BraceletPricingRules,
} from "@bino-foundry/shared/types";

import type { BeadSize, PlacedBead } from "@/lib/luxe-data";
import { useCatalogue } from "@/state/catalogue";
import type { BeadLibraryEntry } from "@/types/beads";
import type { BeadSizeEntry } from "@/types/bead-sizes";

import { prunePlacedBeads, remapPlacedBeadSizes, strandCapacity } from "../capacity";
import { buildBraceletPricing } from "../pricing";
import { serializeBraceletConfiguration } from "../serialize";
import { buildBraceletBuilderSummary } from "../summary";

function clampWristSize(value: number) {
  const clamped = Math.max(14, Math.min(20, value));
  return Math.round(clamped * 2) / 2;
}

function buildPlacedBead(
  bead: BeadLibraryEntry | null,
  position: number,
  defaultBeadSize: BeadSize,
): PlacedBead | null {
  if (!bead) return null;
  return { position, bead, beadSize: defaultBeadSize };
}

function resolveDefaultSizeMm(sizes: BeadSizeEntry[]): number {
  const active = sizes.filter((s) => s.isActive !== false);
  const def = active.find((s) => s.isDefault) ?? active[0];
  return def?.sizeMm ?? 8;
}

export interface UseBraceletBuilderOptions {
  onPriceChange?: (total: number) => void;
  pricingRules?: BraceletPricingRules;
}

export function useBraceletBuilder(options: UseBraceletBuilderOptions = {}) {
  const { onPriceChange, pricingRules: pricingRulesProp } = options;
  const { beadTypes, beadSizes } = useCatalogue();

  const pricingRules = pricingRulesProp ?? DEFAULT_BRACELET_PRICING_RULES;
  const activeSizes = useMemo(
    () => [...beadSizes].filter((s) => s.isActive !== false).sort((a, b) => a.sizeMm - b.sizeMm),
    [beadSizes],
  );

  const [wristSizeA, setWristSizeA] = useState(16);
  const [wristSizeB, setWristSizeB] = useState(16);
  const [defaultBeadSize, setDefaultBeadSize] = useState<number>(() => resolveDefaultSizeMm(beadSizes));
  const [placedBeadsA, setPlacedBeadsA] = useState<PlacedBead[]>([]);
  const [placedBeadsB, setPlacedBeadsB] = useState<PlacedBead[]>([]);
  const [twinning, setTwinning] = useState(false);
  const [selectedBead, setSelectedBead] = useState<BeadLibraryEntry | null>(null);
  const [layoutRevision, setLayoutRevision] = useState(0);

  useEffect(() => {
    if (!beadSizes.length) return;
    const valid = activeSizes.some((s) => s.sizeMm === defaultBeadSize);
    if (!valid) setDefaultBeadSize(resolveDefaultSizeMm(beadSizes));
  }, [beadSizes, activeSizes, defaultBeadSize]);

  const beadCountA = strandCapacity(wristSizeA, defaultBeadSize);
  const beadCountB = strandCapacity(wristSizeB, defaultBeadSize);

  const bumpLayout = useCallback(() => setLayoutRevision((n) => n + 1), []);

  useEffect(() => {
    setPlacedBeadsA((prev) => {
      const next = prunePlacedBeads(prev, beadCountA);
      return next.length === prev.length ? prev : next;
    });
    setPlacedBeadsB((prev) => {
      const next = prunePlacedBeads(prev, beadCountB);
      return next.length === prev.length ? prev : next;
    });
    bumpLayout();
  }, [wristSizeA, wristSizeB, defaultBeadSize, beadCountA, beadCountB, bumpLayout]);

  const setDefaultBeadSizeAndRemap = useCallback(
    (mm: number) => {
      setDefaultBeadSize(mm);
      setPlacedBeadsA((prev) => remapPlacedBeadSizes(prev, mm));
      setPlacedBeadsB((prev) => remapPlacedBeadSizes(prev, mm));
      bumpLayout();
    },
    [bumpLayout],
  );

  const pricing = useMemo(
    () =>
      buildBraceletPricing(
        placedBeadsA,
        placedBeadsB,
        twinning,
        wristSizeA,
        wristSizeB,
        defaultBeadSize,
        pricingRules,
        beadTypes,
        activeSizes,
      ),
    [
      placedBeadsA,
      placedBeadsB,
      twinning,
      wristSizeA,
      wristSizeB,
      defaultBeadSize,
      pricingRules,
      beadTypes,
      activeSizes,
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
        defaultBeadSize,
        pricing,
        activeSizes,
      ),
    [placedBeadsA, placedBeadsB, twinning, wristSizeA, wristSizeB, defaultBeadSize, pricing, activeSizes],
  );

  const configuration = useMemo(
    () =>
      serializeBraceletConfiguration(
        placedBeadsA,
        placedBeadsB,
        twinning,
        wristSizeA,
        wristSizeB,
        defaultBeadSize,
        pricing,
        "draft",
      ),
    [placedBeadsA, placedBeadsB, twinning, wristSizeA, wristSizeB, defaultBeadSize, pricing],
  );

  useEffect(() => {
    onPriceChange?.(pricing.total);
  }, [pricing.total, onPriceChange]);

  const handleSlotClick = useCallback(
    (bracelet: "A" | "B", position: number) => {
      const placedBeads = bracelet === "A" ? placedBeadsA : placedBeadsB;
      const setPlacedBeads = bracelet === "A" ? setPlacedBeadsA : setPlacedBeadsB;
      const existing = placedBeads.find((b) => b.position === position);
      let updated: PlacedBead[];

      if (existing && !selectedBead) {
        updated = placedBeads.filter((b) => b.position !== position);
      } else if (selectedBead) {
        const newBead = buildPlacedBead(selectedBead, position, defaultBeadSize);
        if (!newBead) return;
        updated = existing
          ? placedBeads.map((b) => (b.position === position ? newBead : b))
          : [...placedBeads, newBead];
      } else {
        return { openLibrary: true as const };
      }

      setPlacedBeads(updated);
      return { openLibrary: false as const };
    },
    [placedBeadsA, placedBeadsB, selectedBead, defaultBeadSize],
  );

  const handleBeadDrop = useCallback(
    (bracelet: "A" | "B", position: number, data: { bead?: BeadLibraryEntry }) => {
      const placedBeads = bracelet === "A" ? placedBeadsA : placedBeadsB;
      const setPlacedBeads = bracelet === "A" ? setPlacedBeadsA : setPlacedBeadsB;
      const existing = placedBeads.find((b) => b.position === position);
      const newItem = buildPlacedBead(data?.bead ?? null, position, defaultBeadSize);
      if (!newItem) return;
      const updated = existing
        ? placedBeads.map((b) => (b.position === position ? newItem : b))
        : [...placedBeads, newItem];
      setPlacedBeads(updated);
    },
    [placedBeadsA, placedBeadsB, defaultBeadSize],
  );

  const handleBeadsReorder = useCallback((bracelet: "A" | "B", reordered: PlacedBead[]) => {
    if (bracelet === "A") setPlacedBeadsA(reordered);
    else setPlacedBeadsB(reordered);
  }, []);

  const handleRemoveBead = useCallback((bracelet: "A" | "B", position: number) => {
    const setPlacedBeads = bracelet === "A" ? setPlacedBeadsA : setPlacedBeadsB;
    setPlacedBeads((prev) => prev.filter((b) => b.position !== position));
  }, []);

  const handleDuplicateBraceletToB = useCallback(() => {
    if (!twinning) return;
    setPlacedBeadsB(
      placedBeadsA
        .filter((b) => b.position < beadCountB)
        .map((b) => ({
          position: b.position,
          bead: b.bead,
          beadSize: b.beadSize,
        })),
    );
    bumpLayout();
  }, [twinning, placedBeadsA, beadCountB, bumpLayout]);

  const autoPlaceItem = useCallback(
    (newBead: PlacedBead) => {
      for (let i = 0; i < beadCountA; i++) {
        if (!placedBeadsA.find((b) => b.position === i)) {
          setPlacedBeadsA([...placedBeadsA, { ...newBead, position: i }]);
          return;
        }
      }
      if (twinning) {
        for (let i = 0; i < beadCountB; i++) {
          if (!placedBeadsB.find((b) => b.position === i)) {
            setPlacedBeadsB([...placedBeadsB, { ...newBead, position: i }]);
            return;
          }
        }
      }
    },
    [beadCountA, beadCountB, placedBeadsA, placedBeadsB, twinning],
  );

  const handleSelectBead = useCallback(
    (bead: BeadLibraryEntry) => {
      setSelectedBead(bead);
      autoPlaceItem({ position: 0, bead, beadSize: defaultBeadSize });
    },
    [autoPlaceItem, defaultBeadSize],
  );

  const handleReset = useCallback(() => {
    setPlacedBeadsA([]);
    setPlacedBeadsB([]);
    setSelectedBead(null);
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
        defaultBeadSize,
        pricing,
        status,
      ),
    [placedBeadsA, placedBeadsB, twinning, wristSizeA, wristSizeB, defaultBeadSize, pricing],
  );

  return {
    activeBeadSizes: activeSizes,
    wristSizeA,
    wristSizeB,
    setWristA,
    setWristB,
    defaultBeadSize,
    setDefaultBeadSize: setDefaultBeadSizeAndRemap,
    placedBeadsA,
    placedBeadsB,
    twinning,
    selectedBead,
    setSelectedBead,
    beadCountA,
    beadCountB,
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
  };
}
