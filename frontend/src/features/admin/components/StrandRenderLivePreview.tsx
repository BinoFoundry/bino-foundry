import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { StrandRenderProfile } from "@bino-foundry/shared/types";
import { beadLibraryInheritsTypeStrandDefaults } from "@bino-foundry/shared/types";

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

export function pickPreviewSizeOffer(
  sampleBead: BeadLibraryEntry | null | undefined,
  beadLibrarySizes: BeadLibrarySizeOffer[],
  fallbackMm = STRAND_RENDER_PREVIEW_BEAD_MM,
): { sizeMm: number; offer: BeadLibrarySizeOffer | null } {
  if (!sampleBead) {
    return { sizeMm: fallbackMm, offer: null };
  }
  const offers = beadLibrarySizes.filter((o) => o.beadLibraryId === sampleBead.id && o.sizeMm > 0);
  if (!offers.length) {
    return { sizeMm: fallbackMm, offer: null };
  }
  const preferred = offers.find((o) => o.isDefault) ?? offers[0]!;
  return { sizeMm: preferred.sizeMm, offer: preferred };
}

/**
 * Builder bracelets are rarely jammed full — seed ~55% capacity (min 8)
 * so spacing matches typical live use.
 */
export function previewBeadCount(wristSizeCm: number, beadSizeMm: number): number {
  const full = calculateBeadCount(wristSizeCm, beadSizeMm);
  return Math.max(8, Math.min(full, Math.round(full * 0.55)));
}

export function buildPreviewPlacedBeads(
  sampleBead: BeadLibraryEntry,
  sizeOffer: Pick<BeadLibrarySizeOffer, "sizeMm" | "label" | "unitPrice" | "offerKey"> &
    Partial<BeadLibrarySizeOffer>,
  wristSizeCm = STRAND_RENDER_PREVIEW_WRIST_CM,
): PlacedBead[] {
  const count = previewBeadCount(wristSizeCm, sizeOffer.sizeMm);
  return Array.from({ length: count }, (_, position) =>
    previewPlacedBeadFromSample(sampleBead, sizeOffer, position),
  );
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

  const sizePick = useMemo(
    () => pickPreviewSizeOffer(sampleBead, beadLibrarySizes, STRAND_RENDER_PREVIEW_BEAD_MM),
    [sampleBead, beadLibrarySizes],
  );
  const beadSizeMm = beadSizeMmProp ?? sizePick.sizeMm;

  const seedBeads = useMemo(() => {
    if (!sampleBead) return [];
    const offer =
      sizePick.offer ??
      ({
        sizeMm: beadSizeMm,
        label: `${beadSizeMm}mm`,
        unitPrice: 0,
        offerKey: `${sampleBead.id}:${beadSizeMm}`,
      } satisfies Pick<BeadLibrarySizeOffer, "sizeMm" | "label" | "unitPrice" | "offerKey">);
    return buildPreviewPlacedBeads(sampleBead, offer, wristSizeCm);
  }, [sampleBead, sizePick.offer, beadSizeMm, wristSizeCm]);

  const [placedBeads, setPlacedBeads] = useState<PlacedBead[]>(seedBeads);
  useEffect(() => {
    setPlacedBeads(seedBeads);
  }, [seedBeads]);

  /** Default ON so slider drafts update the preview instantly (same math as Builder). */
  const [applyDraft, setApplyDraft] = useState(true);

  const sampleHasBeadOverride =
    sampleBead != null && !beadLibraryInheritsTypeStrandDefaults(sampleBead.metadata ?? null);

  const { containerRef, strandSize, containerSize } = useAdminStrandCanvasSize(true);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [panMode, setPanMode] = useState(false);

  const layoutCanvasSize = strandSize;
  const strandZoomLayout = useMemo(
    () => ({
      viewportWidthPx: containerSize.width,
      viewportHeightPx: containerSize.height,
      layoutCanvasSize,
      twinning: false,
    }),
    [containerSize.width, containerSize.height, layoutCanvasSize],
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
    setPlacedBeads(seedBeads);
  }, [seedBeads]);

  const layoutKey = useMemo(
    () =>
      [
        wristSizeCm,
        placedBeads.map((b) => `${b.position}:${b.size.offerKey}`).join(","),
        applyDraft ? "draft" : "catalogue",
        applyDraft
          ? [
              profile.layoutScale,
              profile.contactWidth,
              profile.contactOffset,
              profile.spacingAdjustment,
              profile.visualScale,
              profile.hangOffset,
              profile.verticalOffset,
              profile.anchorY,
              profile.orientationMode,
              profile.balanceSpacing ? 1 : 0,
            ].join(":")
          : "cat",
      ].join("|"),
    [wristSizeCm, placedBeads, applyDraft, profile],
  );

  return (
    <div className={className}>
      <div className="mb-2 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Live Preview</p>
            <p className="text-xs text-muted-foreground">
              Same Bracelet Builder strand (viewport, zoom, canvas, renderer).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Wrist
              <select
                className={adminFieldClass("h-8 w-auto py-1 text-xs")}
                value={wristSizeCm}
                onChange={(e) => setWristSizeCm(Number(e.target.value))}
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
            <button
              type="button"
              className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted/40"
              onClick={handleResetStrand}
            >
              Reset strand
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={applyDraft}
            onChange={(e) => setApplyDraft(e.target.checked)}
          />
          Apply draft settings to preview
        </label>
        {!applyDraft ? (
          <p className="text-xs text-muted-foreground">
            Preview uses saved catalogue resolve — identical to the live Builder after Save.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Draft values update the strand live (same layout pipeline as the Bracelet Builder).
          </p>
        )}
        {!sampleBead ? (
          <p className="text-xs text-muted-foreground">
            Add a bead of this type to seed the strand with a real asset.
          </p>
        ) : null}
        {sampleHasBeadOverride && !applyDraft ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Sample bead has its own render override — Builder will keep that until beads inherit
            this type/sub-type.
          </p>
        ) : null}
      </div>

      <div
        className="relative overflow-hidden rounded-lg border border-border bg-background"
        style={{ height: 440 }}
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
                  forceStrandRenderProfile={applyDraft ? profile : null}
                />
              </StrandStage>
            </StrandViewport>
          </BuilderPreviewFitScope>
        </div>
      </div>
    </div>
  );
}
