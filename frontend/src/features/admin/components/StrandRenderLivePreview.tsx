import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { StrandRenderProfile } from "@bino-foundry/shared/types";
import {
  beadLibraryInheritsTypeStrandDefaults,
  effectiveStrandContactWidth,
  STRAND_VISUAL_SIZE_SCALING_ANCHOR_MM,
} from "@bino-foundry/shared/types";

import SortableCircularStrand from "@/components/SortableCircularStrand";
import { BuilderPreviewFitScope } from "@/features/builder/components/BuilderPreviewFitScope";
import {
  StrandStage,
  StrandViewport,
  StrandZoomControls,
  useStrandZoom,
  measureStrandCanvasSize,
  catalogueWristSizeBounds,
  activeWristSizes,
  defaultWristSize,
  findWristSizeByCm,
} from "@/features/bracelet";
import { calculateBeadCount, type PlacedBead } from "@/lib/luxe-data";
import type { BeadLibrarySizeOffer } from "@/types/bead-library-sizes";
import type { BeadLibraryEntry } from "@/types/beads";
import { useCatalogue } from "@/state/catalogue";
import { useIsMobile } from "@/hooks/use-mobile";
import { adminFieldClass } from "./admin-styles";

/** Preferred default wrist when present in catalogue. */
export const STRAND_RENDER_PREVIEW_WRIST_CM = 18;
export const STRAND_RENDER_PREVIEW_BEAD_MM = 8;
/** Fallback when ResizeObserver has not measured yet. */
export const STRAND_RENDER_PREVIEW_CANVAS_PX = 320;
export const STRAND_RENDER_PREVIEW_VIEW_W = STRAND_RENDER_PREVIEW_CANVAS_PX;
export const STRAND_RENDER_PREVIEW_VIEW_H = STRAND_RENDER_PREVIEW_CANVAS_PX;

export interface StrandRenderLivePreviewProps {
  profile: StrandRenderProfile;
  imageUrl?: string | null;
  sampleBead?: BeadLibraryEntry | null;
  wristSizeCm?: number;
  /**
   * Enabled bead sizes from the current editor form (unsaved state).
   * When set, Preview Size options come from this list instead of only the catalogue.
   */
  previewSizeMms?: number[];
  /** @deprecated Prefer previewSizeMms + internal selector; still honored as initial preference. */
  beadSizeMm?: number;
  className?: string;
}

/** Build a PlacedBead so Admin preview uses the same sizing path as the Builder. */
export function previewPlacedBeadFromSample(
  sampleBead: BeadLibraryEntry,
  sizeOffer: Pick<BeadLibrarySizeOffer, "sizeMm" | "label" | "unitPrice" | "offerKey"> &
    Partial<BeadLibrarySizeOffer>,
  position = 0,
): PlacedBead {
  return {
    position,
    bead: sampleBead,
    size: {
      id: sizeOffer.id ?? "preview-size",
      beadLibraryId: sampleBead.id,
      beadSizeId: sizeOffer.beadSizeId ?? "preview-bead-size",
      sizeMm: sizeOffer.sizeMm,
      label: sizeOffer.label || `${sizeOffer.sizeMm}mm`,
      unitPrice: sizeOffer.unitPrice ?? 0,
      offerKey: sizeOffer.offerKey || `${sampleBead.id}:${sizeOffer.sizeMm}`,
      isDefault: sizeOffer.isDefault,
      displayOrder: sizeOffer.displayOrder,
      normalizationFactor: sizeOffer.normalizationFactor,
      assetVisibleDiameterPx: sizeOffer.assetVisibleDiameterPx,
      groupReferenceDiameterPx: sizeOffer.groupReferenceDiameterPx,
      normalizedProcessedImageUrl: sizeOffer.normalizedProcessedImageUrl,
      normalizedDeliveryUrls: sizeOffer.normalizedDeliveryUrls,
      normalizedVisibleDiameterPx: sizeOffer.normalizedVisibleDiameterPx,
      needsNormalizedReexport: sizeOffer.needsNormalizedReexport,
    },
  };
}

/** Unique positive mm values, sorted ascending. */
export function normalizePreviewSizeMms(sizeMms: number[] | null | undefined): number[] {
  if (!sizeMms?.length) return [];
  return [...new Set(sizeMms.filter((mm) => Number.isFinite(mm) && mm > 0))].sort((a, b) => a - b);
}

/**
 * Resolve which sizes the Admin can preview.
 * Prefer editor form enabled sizes; fall back to the sample bead's catalogue offers.
 */
export function resolvePreviewSizeOptions(
  sampleBead: BeadLibraryEntry | null | undefined,
  beadLibrarySizes: BeadLibrarySizeOffer[],
  enabledSizeMms?: number[] | null,
): number[] {
  const fromForm = normalizePreviewSizeMms(enabledSizeMms);
  if (fromForm.length) return fromForm;

  if (!sampleBead?.id) return [STRAND_RENDER_PREVIEW_BEAD_MM];

  const fromCatalogue = normalizePreviewSizeMms(
    beadLibrarySizes
      .filter((o) => o.beadLibraryId === sampleBead.id && o.availableForNew !== false)
      .map((o) => o.sizeMm),
  );
  return fromCatalogue.length ? fromCatalogue : [STRAND_RENDER_PREVIEW_BEAD_MM];
}

export function pickPreviewSizeOffer(
  sampleBead: BeadLibraryEntry | null | undefined,
  beadLibrarySizes: BeadLibrarySizeOffer[],
  preferredMm?: number | null,
  allowedMms?: number[] | null,
  fallbackMm = STRAND_RENDER_PREVIEW_BEAD_MM,
): { sizeMm: number; offer: BeadLibrarySizeOffer | null } {
  const options = resolvePreviewSizeOptions(sampleBead, beadLibrarySizes, allowedMms);
  const catalogueOffers = sampleBead
    ? beadLibrarySizes.filter((o) => o.beadLibraryId === sampleBead.id && o.sizeMm > 0)
    : [];

  const preferredOk =
    preferredMm != null && preferredMm > 0 && options.includes(preferredMm) ? preferredMm : null;

  const defaultOffer = catalogueOffers.find(
    (o) => o.isDefault && options.includes(o.sizeMm) && o.availableForNew !== false,
  );
  const sizeMm =
    preferredOk ??
    defaultOffer?.sizeMm ??
    options[0] ??
    fallbackMm;

  const offer =
    catalogueOffers.find((o) => o.sizeMm === sizeMm) ??
    null;

  return { sizeMm, offer };
}

function syntheticPreviewOffer(
  sampleBead: BeadLibraryEntry,
  sizeMm: number,
  offer: BeadLibrarySizeOffer | null,
): Pick<BeadLibrarySizeOffer, "sizeMm" | "label" | "unitPrice" | "offerKey"> &
  Partial<BeadLibrarySizeOffer> {
  if (offer && offer.sizeMm === sizeMm) return offer;
  return {
    ...(offer ?? {}),
    sizeMm,
    label: `${sizeMm} mm`,
    unitPrice: offer?.unitPrice ?? 0,
    offerKey: `${sampleBead.id}:${sizeMm}`,
  };
}

/**
 * Full strand capacity for the selected wrist + bead mm (Builder formula).
 * Live Preview bead count cannot exceed this.
 */
export function previewMaxBeadCount(wristSizeCm: number, beadSizeMm: number): number {
  return calculateBeadCount(wristSizeCm, beadSizeMm);
}

/**
 * Builder bracelets are rarely jammed full — seed ~55% capacity (min 8)
 * so spacing matches typical live use. Always ≤ {@link previewMaxBeadCount}.
 */
export function previewBeadCount(wristSizeCm: number, beadSizeMm: number): number {
  const full = previewMaxBeadCount(wristSizeCm, beadSizeMm);
  return Math.max(8, Math.min(full, Math.round(full * 0.55)));
}

/** Clamp a requested preview count into [1, capacity]. */
export function clampPreviewBeadCount(
  count: number,
  wristSizeCm: number,
  beadSizeMm: number,
): number {
  const max = previewMaxBeadCount(wristSizeCm, beadSizeMm);
  if (!Number.isFinite(count)) return previewBeadCount(wristSizeCm, beadSizeMm);
  return Math.max(1, Math.min(max, Math.round(count)));
}

export function buildPreviewPlacedBeads(
  sampleBead: BeadLibraryEntry,
  sizeOffer: Pick<BeadLibrarySizeOffer, "sizeMm" | "label" | "unitPrice" | "offerKey"> &
    Partial<BeadLibrarySizeOffer>,
  wristSizeCm = STRAND_RENDER_PREVIEW_WRIST_CM,
  beadCount?: number,
): PlacedBead[] {
  const count =
    beadCount != null
      ? clampPreviewBeadCount(beadCount, wristSizeCm, sizeOffer.sizeMm)
      : previewBeadCount(wristSizeCm, sizeOffer.sizeMm);
  return Array.from({ length: count }, (_, position) =>
    previewPlacedBeadFromSample(sampleBead, sizeOffer, position),
  );
}

/** Preferred mm sizes kept for docs/tests; compare mode uses enabled sizes instead. */
export const VISUAL_SIZE_SCALING_COMPARE_MM = [
  STRAND_VISUAL_SIZE_SCALING_ANCHOR_MM,
  8,
  10,
] as const;

/**
 * Sizes for the visual-size-scaling A/B preview.
 * Prefers every enabled size on the bead (≥2). When a charm (or any bead) only
 * has one enabled SKU, falls back to the 6/8/10 mm ladder so Compare still works.
 */
export function resolveVisualSizeScalingCompareMms(
  sizeOptions: number[],
  options?: { allowSyntheticFallback?: boolean },
): number[] {
  const available = normalizePreviewSizeMms(sizeOptions);
  if (available.length >= 2) return available;
  if (options?.allowSyntheticFallback !== false) {
    return normalizePreviewSizeMms([
      ...available,
      ...VISUAL_SIZE_SCALING_COMPARE_MM,
    ]);
  }
  return [];
}

/** True when Compare is using the synthetic 6/8/10 ladder (not only enabled SKUs). */
export function compareSizesUsesSyntheticFallback(sizeOptions: number[], compareMms: number[]): boolean {
  const enabled = normalizePreviewSizeMms(sizeOptions);
  if (enabled.length >= 2) return false;
  if (compareMms.length < 2) return false;
  return compareMms.some((mm) => !enabled.includes(mm));
}

/**
 * Seed alternating mm sizes for Compare mode without overfilling the wrist.
 *
 * Uniform preview counts from the smallest/anchor mm; alternating larger sizes then
 * push the strand over capacity and the packer compresses centres — historically the
 * CSS shells stayed full-size and overlapped. Cap the fill from the real size sequence.
 */
export function buildComparePreviewPlacedBeads(
  sampleBead: BeadLibraryEntry,
  beadLibrarySizes: BeadLibrarySizeOffer[],
  compareMms: number[],
  wristSizeCm = STRAND_RENDER_PREVIEW_WRIST_CM,
): PlacedBead[] {
  if (compareMms.length < 2) return [];

  const wristMm = Math.max(1, wristSizeCm * 10);
  // Partial fill like typical Builder use — leave headroom so mixed sizes stay edge-to-edge.
  const targetFillMm = wristMm * 0.5;
  const catalogueOffers = beadLibrarySizes.filter((o) => o.beadLibraryId === sampleBead.id);

  const beads: PlacedBead[] = [];
  let usedMm = 0;
  let position = 0;
  // Always show at least one full cycle of compare sizes when they fit.
  const minCount = compareMms.length;
  while (true) {
    const sizeMm = compareMms[position % compareMms.length]!;
    if (beads.length >= minCount && usedMm + sizeMm > targetFillMm) break;
    // Hard stop: never seed past ~90% wrist — beyond that pack compression is expected.
    if (usedMm + sizeMm > wristMm * 0.9 && beads.length >= minCount) break;

    const offer = catalogueOffers.find((o) => o.sizeMm === sizeMm) ?? null;
    beads.push(
      previewPlacedBeadFromSample(
        sampleBead,
        syntheticPreviewOffer(sampleBead, sizeMm, offer),
        position,
      ),
    );
    usedMm += sizeMm;
    position += 1;
    if (position > 200) break;
  }
  return beads;
}

function useAdminStrandCanvasSize(enabled: boolean) {
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const [strandSize, setStrandSize] = useState(STRAND_RENDER_PREVIEW_CANVAS_PX);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const measure = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setContainerSize({ width: rect.width, height: rect.height });
    setStrandSize(
      measureStrandCanvasSize({
        containerWidth: rect.width,
        containerHeight: rect.height,
        isMobile,
        twinning: false,
        libraryOpen: false,
      }),
    );
  }, [isMobile]);

  useEffect(() => {
    if (!enabled) return;
    measure();
    const node = containerRef.current;
    if (!node) return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [enabled, measure]);

  return { containerRef, strandSize, containerSize };
}

/**
 * Admin Live Preview — same Bracelet Builder strand stage (viewport, zoom, canvas measure,
 * SortableCircularStrand). Draft settings can be applied optionally; turn off to match
 * catalogue resolve exactly like the live Builder.
 */
export function StrandRenderLivePreview({
  profile,
  sampleBead = null,
  wristSizeCm: wristSizeCmProp,
  previewSizeMms,
  beadSizeMm: beadSizeMmProp,
  className,
}: StrandRenderLivePreviewProps) {
  const { beadLibrarySizes, wristSizes } = useCatalogue();
  const wristOptions = useMemo(() => activeWristSizes(wristSizes), [wristSizes]);
  const wristSizeBounds = useMemo(() => catalogueWristSizeBounds(wristSizes), [wristSizes]);

  const initialWristCm = useMemo(() => {
    if (wristSizeCmProp && wristSizeCmProp > 0) return wristSizeCmProp;
    const preferred =
      findWristSizeByCm(wristSizes, STRAND_RENDER_PREVIEW_WRIST_CM) ?? defaultWristSize(wristSizes);
    return preferred?.sizeCm ?? STRAND_RENDER_PREVIEW_WRIST_CM;
  }, [wristSizeCmProp, wristSizes]);

  const [wristSizeCm, setWristSizeCm] = useState(initialWristCm);
  useEffect(() => {
    setWristSizeCm(initialWristCm);
  }, [initialWristCm]);

  const sizeOptions = useMemo(
    () => resolvePreviewSizeOptions(sampleBead, beadLibrarySizes, previewSizeMms),
    [sampleBead, beadLibrarySizes, previewSizeMms],
  );

  /** null = use default/preferred from options; set when Admin picks Preview Size. */
  const [previewSizeMm, setPreviewSizeMm] = useState<number | null>(beadSizeMmProp ?? null);

  useEffect(() => {
    if (previewSizeMm == null) return;
    if (sizeOptions.length && !sizeOptions.includes(previewSizeMm)) {
      setPreviewSizeMm(null);
    }
  }, [sizeOptions, previewSizeMm]);

  const sizePick = useMemo(
    () =>
      pickPreviewSizeOffer(sampleBead, beadLibrarySizes, previewSizeMm ?? beadSizeMmProp, sizeOptions),
    [sampleBead, beadLibrarySizes, previewSizeMm, beadSizeMmProp, sizeOptions],
  );
  const beadSizeMm = sizePick.sizeMm;

  const compareSizeMms = useMemo(
    () => resolveVisualSizeScalingCompareMms(sizeOptions, { allowSyntheticFallback: true }),
    [sizeOptions],
  );
  const compareSizesAvailable = compareSizeMms.length >= 2;
  const compareIsSynthetic = useMemo(
    () => compareSizesUsesSyntheticFallback(sizeOptions, compareSizeMms),
    [sizeOptions, compareSizeMms],
  );
  const isDanglingPreview = profile.layoutMode === "dangling";

  const maxBeadCount = useMemo(
    () => previewMaxBeadCount(wristSizeCm, beadSizeMm),
    [wristSizeCm, beadSizeMm],
  );
  const defaultBeadCount = useMemo(
    () => previewBeadCount(wristSizeCm, beadSizeMm),
    [wristSizeCm, beadSizeMm],
  );
  const [beadCount, setBeadCount] = useState(defaultBeadCount);
  useEffect(() => {
    setBeadCount((prev) => clampPreviewBeadCount(prev, wristSizeCm, beadSizeMm));
  }, [wristSizeCm, beadSizeMm, maxBeadCount]);

  const uniformSeedBeads = useMemo(() => {
    if (!sampleBead) return [];
    const offer = syntheticPreviewOffer(sampleBead, beadSizeMm, sizePick.offer);
    return buildPreviewPlacedBeads(sampleBead, offer, wristSizeCm, beadCount);
  }, [sampleBead, sizePick.offer, beadSizeMm, wristSizeCm, beadCount]);

  const compareSeedBeads = useMemo(() => {
    if (!sampleBead || !compareSizesAvailable) return [];
    return buildComparePreviewPlacedBeads(
      sampleBead,
      beadLibrarySizes,
      compareSizeMms,
      wristSizeCm,
    );
  }, [sampleBead, beadLibrarySizes, compareSizeMms, compareSizesAvailable, wristSizeCm]);

  const [compareSizes, setCompareSizes] = useState(false);
  useEffect(() => {
    if (!compareSizesAvailable) setCompareSizes(false);
  }, [compareSizesAvailable]);

  const seedBeads = compareSizes && compareSizesAvailable ? compareSeedBeads : uniformSeedBeads;

  const [placedBeads, setPlacedBeads] = useState<PlacedBead[]>(seedBeads);
  useEffect(() => {
    setPlacedBeads(seedBeads);
  }, [seedBeads]);

  /** Default ON so slider drafts update the preview instantly (same math as Builder). */
  const [applyDraft, setApplyDraft] = useState(true);
  /**
   * Balance Spacing equalises leftover gaps on a sparse strand, which hides occupancy.
   * Reveal mode: Natural 1.00 vs *your* Strand occupancy, with amber cord arcs.
   */
  const [revealOccupancyGaps, setRevealOccupancyGaps] = useState(false);

  const draftOccupancy = useMemo(
    () =>
      effectiveStrandContactWidth({
        contactWidth: profile.contactWidth,
        contactOffset: profile.contactOffset,
        spacingAdjustment: profile.spacingAdjustment,
      }),
    [profile.contactWidth, profile.contactOffset, profile.spacingAdjustment],
  );

  const effectiveProfile = useMemo(
    () =>
      revealOccupancyGaps ? { ...profile, balanceSpacing: false } : profile,
    [profile, revealOccupancyGaps],
  );

  /** Baseline natural claim (1.00) for comparison. */
  const occupancyBaselineProfile = useMemo(
    () => ({
      ...effectiveProfile,
      balanceSpacing: false,
      contactWidth: 1,
      contactOffset: 0,
      spacingAdjustment: 0,
      strandOccupancy: 1,
    }),
    [effectiveProfile],
  );

  /** Live draft occupancy from the Strand occupancy control. */
  const occupancyDraftProfile = useMemo(
    () => ({
      ...effectiveProfile,
      balanceSpacing: false,
      contactWidth: 1,
      contactOffset: draftOccupancy - 1,
      spacingAdjustment: 0,
      strandOccupancy: draftOccupancy,
    }),
    [effectiveProfile, draftOccupancy],
  );

  useEffect(() => {
    if (!revealOccupancyGaps) return;
    const demoCount = clampPreviewBeadCount(6, wristSizeCm, beadSizeMm);
    setBeadCount(demoCount);
  }, [revealOccupancyGaps, wristSizeCm, beadSizeMm]);

  const sampleHasBeadOverride =
    sampleBead != null && !beadLibraryInheritsTypeStrandDefaults(sampleBead.metadata ?? null);

  const { containerRef, strandSize, containerSize } = useAdminStrandCanvasSize(true);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [panMode, setPanMode] = useState(false);

  const handleReorder = useCallback((fromPosition: number, toPosition: number) => {
    setPlacedBeads((prev) => {
      const next = [...prev];
      const from = next.findIndex((b) => b.position === fromPosition);
      const to = next.findIndex((b) => b.position === toPosition);
      if (from < 0 || to < 0 || from === to) return prev;
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      return next.map((b, i) => ({ ...b, position: i }));
    });
  }, []);

  const handleRemove = useCallback((position: number) => {
    setPlacedBeads((prev) =>
      prev.filter((b) => b.position !== position).map((b, i) => ({ ...b, position: i })),
    );
  }, []);

  const handleResetStrand = useCallback(() => {
    setBeadCount(defaultBeadCount);
    setPlacedBeads(
      compareSizes && compareSizesAvailable
        ? compareSeedBeads
        : sampleBead
          ? buildPreviewPlacedBeads(
              sampleBead,
              syntheticPreviewOffer(sampleBead, beadSizeMm, sizePick.offer),
              wristSizeCm,
              defaultBeadCount,
            )
          : [],
    );
  }, [
    defaultBeadCount,
    compareSizes,
    compareSizesAvailable,
    compareSeedBeads,
    sampleBead,
    beadSizeMm,
    sizePick.offer,
    wristSizeCm,
  ]);

  const layoutKey = useMemo(
    () =>
      [
        wristSizeCm,
        beadSizeMm,
        placedBeads.map((b) => `${b.position}:${b.size.offerKey}:${b.size.sizeMm}`).join(","),
        compareSizes ? "compare" : "uniform",
        compareSizes ? compareSizeMms.join(",") : "",
        applyDraft ? "draft" : "catalogue",
        applyDraft
          ? [
              effectiveProfile.layoutScale,
              effectiveProfile.contactWidth,
              effectiveProfile.contactOffset,
              effectiveProfile.spacingAdjustment,
              effectiveProfile.visualScale,
              effectiveProfile.visualSizeScaling,
              effectiveProfile.hangOffset,
              effectiveProfile.verticalOffset,
              effectiveProfile.anchorY,
              effectiveProfile.orientationMode,
              effectiveProfile.layoutMode,
              effectiveProfile.balanceSpacing ? 1 : 0,
              revealOccupancyGaps ? `reveal-occ:${draftOccupancy}` : "bal",
            ].join(":")
          : "cat",
      ].join("|"),
    [
      wristSizeCm,
      beadSizeMm,
      placedBeads,
      compareSizes,
      compareSizeMms,
      applyDraft,
      effectiveProfile,
      revealOccupancyGaps,
      draftOccupancy,
    ],
  );

  const layoutCanvasSize = strandSize;
  const strandZoomLayout = useMemo(
    () => ({
      viewportWidthPx: containerSize.width,
      viewportHeightPx: containerSize.height,
      layoutCanvasSize,
      twinning: false,
      contentKey: layoutKey,
    }),
    [containerSize.width, containerSize.height, layoutCanvasSize, layoutKey],
  );
  const layoutReady =
    containerSize.width > 0 && containerSize.height > 0 && layoutCanvasSize > 0;

  const {
    displayZoom,
    viewScale,
    pan,
    matchingPairLayout,
    isPanning,
    zoomIn,
    zoomOut,
    reset,
    onPanPointerDown,
    onPanPointerMove,
    onPanPointerUp,
    onPanPointerCancel,
  } = useStrandZoom(
    {
      zoomSurfaceRef: containerRef as RefObject<HTMLElement | null>,
      containerRef: containerRef as RefObject<HTMLElement | null>,
      viewportRef: viewportRef as RefObject<HTMLElement | null>,
      contentRef: contentRef as RefObject<HTMLElement | null>,
    },
    strandZoomLayout,
    { panMode, layoutReady },
  );

  return (
    <div className={className}>
      <div className="mb-2 space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Live Preview</p>
            <p className="text-[11px] text-muted-foreground">
              Same renderer as the Bracelet Builder — updates with draft settings.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            {sizeOptions.length > 1 ? (
              <label className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Bead size
                </span>
                <select
                  className={adminFieldClass("h-8 min-w-[5.5rem] py-1 text-xs")}
                  value={beadSizeMm}
                  onChange={(e) => setPreviewSizeMm(Number(e.target.value))}
                  aria-label="Bead size"
                >
                  {sizeOptions.map((mm) => (
                    <option key={mm} value={mm}>
                      {mm} mm
                    </option>
                  ))}
                </select>
              </label>
            ) : sizeOptions.length === 1 ? (
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Bead size
                </span>
                <span className="flex h-8 items-center px-0.5 text-xs tabular-nums text-foreground">
                  {sizeOptions[0]} mm
                </span>
              </div>
            ) : null}

            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Wrist
              </span>
              <select
                className={adminFieldClass("h-8 min-w-[5.5rem] py-1 text-xs")}
                value={wristSizeCm}
                onChange={(e) => setWristSizeCm(Number(e.target.value))}
                aria-label="Wrist size"
              >
                {wristOptions.length ? (
                  wristOptions.map((w) => (
                    <option key={w.id} value={w.sizeCm}>
                      {w.sizeCm} cm
                    </option>
                  ))
                ) : (
                  <option value={wristSizeCm}>{wristSizeCm} cm</option>
                )}
              </select>
            </label>

            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Bead count
              </span>
              <div className="flex h-8 items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={maxBeadCount}
                  step={1}
                  disabled={!sampleBead || (compareSizes && compareSizesAvailable)}
                  className={adminFieldClass("h-8 w-[4.5rem] py-1 text-xs tabular-nums")}
                  value={beadCount}
                  onChange={(e) => {
                    const raw = Number(e.target.value);
                    setBeadCount(clampPreviewBeadCount(raw, wristSizeCm, beadSizeMm));
                  }}
                  aria-label="Preview bead count"
                  title={
                    compareSizes && compareSizesAvailable
                      ? "Disabled while Compare sizes is on"
                      : `Max ${maxBeadCount} for ${wristSizeCm} cm / ${beadSizeMm} mm`
                  }
                />
                <span className="whitespace-nowrap text-[10px] tabular-nums text-muted-foreground">
                  / {maxBeadCount}
                </span>
              </div>
            </label>

            <button
              type="button"
              className="h-8 rounded-md border border-border bg-background px-2.5 text-xs text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
              onClick={handleResetStrand}
            >
              Reset strand
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              className="size-3.5 rounded border-border"
              checked={applyDraft}
              onChange={(e) => setApplyDraft(e.target.checked)}
            />
            Apply draft settings
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              className="size-3.5 rounded border-border"
              checked={revealOccupancyGaps}
              onChange={(e) => setRevealOccupancyGaps(e.target.checked)}
            />
            Reveal occupancy gaps
          </label>
          {compareSizesAvailable ? (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                className="size-3.5 rounded border-border"
                checked={compareSizes}
                onChange={(e) => setCompareSizes(e.target.checked)}
              />
              Compare sizes ({compareSizeMms.map((mm) => `${mm} mm`).join(" · ")})
            </label>
          ) : null}
          <span className="text-[11px] text-muted-foreground">
            {applyDraft
              ? "Unsaved calibration updates the preview immediately."
              : "Showing saved catalogue resolve (as after Save)."}
          </span>
        </div>

        {revealOccupancyGaps ? (
          <ol className="list-decimal space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 pl-7 text-[11px] leading-snug text-amber-950 dark:text-amber-100">
            <li>
              <span className="font-medium">Amber arcs</span> = cord claimed by Strand occupancy.
              Change the <span className="font-medium">Strand occupancy</span> field above — the
              right panel updates to your value (
              <span className="font-medium tabular-nums">{draftOccupancy.toFixed(2)}</span>).
            </li>
            <li>
              Left = natural <span className="font-medium">1.00</span>. Right ={" "}
              <span className="font-medium">your setting</span>. Same Render size &amp; bead count.
            </li>
            <li>
              Values below ~1 often look similar to 1.00 (cannot pack tighter than the image). Try{" "}
              <span className="font-medium">1.5</span> or <span className="font-medium">2.0</span> to
              see longer amber arcs.
            </li>
          </ol>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Turn on <span className="font-medium text-foreground">Reveal occupancy gaps</span> to
            compare natural 1.00 vs your Strand occupancy value with amber cord guides.
          </p>
        )}
        {compareSizes && compareSizesAvailable ? (
          <p className="text-[11px] text-muted-foreground">
            {isDanglingPreview ? (
              <>
                Comparing dangling charm sizes ({compareSizeMms.map((mm) => `${mm} mm`).join(" · ")}
                ). Width follows catalogue mm; height can hang past the cord. Check the smallest and
                largest wrist (incl. 20&nbsp;cm) — Fit zooms out so hang is not clipped.
              </>
            ) : (
              <>
                Comparing sizes ({compareSizeMms.map((mm) => `${mm} mm`).join(" · ")}). Each bead
                keeps its catalogue mm spacing so neighbours do not overlap. Visual size scaling
                changes how sizes other than {STRAND_VISUAL_SIZE_SCALING_ANCHOR_MM}&nbsp;mm look
                relative to the {STRAND_VISUAL_SIZE_SCALING_ANCHOR_MM}&nbsp;mm anchor — lower values
                compress size jumps.
              </>
            )}
            {compareIsSynthetic ? (
              <>
                {" "}
                Sizes marked beyond your enabled SKUs are a preview ladder only — enable those mm
                offers on the bead if customers should buy them.
              </>
            ) : null}
          </p>
        ) : compareSizesAvailable ? (
          <p className="text-[11px] text-muted-foreground">
            {isDanglingPreview
              ? "Enable Compare sizes to preview how different mm charms hang side by side on the same strand (works for single-SKU charms too)."
              : `To preview visual size scaling, enable Compare sizes — a single size will not show curve changes as clearly (the ${STRAND_VISUAL_SIZE_SCALING_ANCHOR_MM} mm size stays anchored).`}
          </p>
        ) : null}

        {isDanglingPreview ? (
          <ol className="list-decimal space-y-1 rounded-md border border-border/70 bg-muted/30 px-3 py-2 pl-7 text-[11px] leading-snug text-muted-foreground">
            <li>
              Set <span className="font-medium text-foreground">Layout mode → Dangling</span>,{" "}
              <span className="font-medium text-foreground">Anchor → Loop</span>,{" "}
              <span className="font-medium text-foreground">Orientation → Outward</span>.
            </li>
            <li>
              Tune <span className="font-medium text-foreground">Vertical offset</span> until the
              hanging ring sits on the cord; use Hang offset only for fine radial push.
            </li>
            <li>
              Turn on <span className="font-medium text-foreground">Compare sizes</span> to see mixed mm
              charms on one bracelet — occupancy (strand space) and Render size (visual) are separate.
            </li>
            <li>
              Switch <span className="font-medium text-foreground">Wrist</span> to the catalogue max
              (e.g. 20&nbsp;cm) and confirm hang is fully visible; use Fit / Reset zoom if needed.
            </li>
            <li>
              Save, then open the Bracelet Builder with the same wrist — final result should match this
              preview.
            </li>
          </ol>
        ) : null}

        {!sampleBead ? (
          <p className="text-[11px] text-muted-foreground">
            Add a bead of this type to seed the strand with a real asset.
          </p>
        ) : null}
        {sampleHasBeadOverride && !applyDraft ? (
          <p className="text-[11px] text-amber-700 dark:text-amber-400">
            Sample bead has its own render override — Builder will keep that until beads inherit
            this type/sub-type.
          </p>
        ) : null}
      </div>

      {revealOccupancyGaps ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              {
                label: "Natural — occupancy 1.00",
                profile: occupancyBaselineProfile,
                key: "baseline",
              },
              {
                label: `Your setting — occupancy ${draftOccupancy.toFixed(2)}`,
                profile: occupancyDraftProfile,
                key: "draft",
              },
            ] as const
          ).map((side) => (
            <div key={side.key} className="overflow-hidden rounded-lg border border-border bg-background">
              <p className="border-b border-border bg-muted/40 px-2 py-1.5 text-[11px] font-medium text-foreground">
                {side.label}
              </p>
              <div className="relative mx-auto" style={{ height: 280, width: "100%" }}>
                <div className="flex h-full items-center justify-center p-2">
                  <StrandStage
                    className="shrink-0"
                    style={{ width: 240, height: 240, minWidth: 240, minHeight: 240 }}
                  >
                    <SortableCircularStrand
                      key={`${layoutKey}:${side.key}`}
                      layoutKey={`${layoutKey}:${side.key}`}
                      placedBeads={placedBeads}
                      onBeadsReorder={() => {}}
                      onSlotClick={() => {}}
                      onBeadRemove={() => {}}
                      wristSize={wristSizeCm}
                      wristSizeBounds={
                        wristSizeBounds.minCm > 0
                          ? wristSizeBounds
                          : { minCm: wristSizeCm, maxCm: wristSizeCm }
                      }
                      guideSizeMm={beadSizeMm}
                      size={240}
                      forceStrandRenderProfile={side.profile}
                      showOccupancyGuides
                      readOnly
                    />
                  </StrandStage>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
      <div
        className="relative overflow-hidden rounded-lg border border-border bg-background"
        style={{ height: 380 }}
      >
        <StrandZoomControls
          zoom={displayZoom}
          panMode={panMode}
          onTogglePan={() => setPanMode((on) => !on)}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onReset={reset}
          className="absolute bottom-3 left-3 z-30"
        />

        <div
          ref={containerRef}
          className="relative flex h-full min-h-0 w-full flex-col overflow-hidden"
          data-strand-zoom-surface
        >
          <BuilderPreviewFitScope builder="bracelet" className="relative flex min-h-0 flex-1 flex-col">
            <StrandViewport
              viewportRef={viewportRef}
              contentRef={contentRef}
              pan={pan}
              isPanning={isPanning}
              viewScale={viewScale}
              panMode={panMode}
              twinning={false}
              matchingPairLayout={matchingPairLayout}
              onPointerDown={onPanPointerDown}
              onPointerMove={onPanPointerMove}
              onPointerUp={onPanPointerUp}
              onPointerCancel={onPanPointerCancel}
            >
              <StrandStage
                className="shrink-0"
                style={{
                  width: layoutCanvasSize,
                  height: layoutCanvasSize,
                  minWidth: layoutCanvasSize,
                  minHeight: layoutCanvasSize,
                }}
              >
                <SortableCircularStrand
                  key={layoutKey}
                  layoutKey={layoutKey}
                  placedBeads={placedBeads}
                  onBeadsReorder={handleReorder}
                  onSlotClick={() => {}}
                  onBeadRemove={handleRemove}
                  wristSize={wristSizeCm}
                  wristSizeBounds={
                    wristSizeBounds.minCm > 0
                      ? wristSizeBounds
                      : { minCm: wristSizeCm, maxCm: wristSizeCm }
                  }
                  guideSizeMm={beadSizeMm}
                  size={layoutCanvasSize}
                  forceStrandRenderProfile={applyDraft ? effectiveProfile : null}
                />
              </StrandStage>
            </StrandViewport>
          </BuilderPreviewFitScope>
        </div>
      </div>
      )}
    </div>
  );
}
