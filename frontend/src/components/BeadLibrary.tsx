import { useMemo, useRef, useState, useCallback, memo, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search, X, Info, Gem } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { BeadInfoButton } from "@/features/bracelet/components/BeadInfoButton";
import { SubBeadTypeTabs } from "@/features/bracelet/components/SubBeadTypeTabs";
import { BRACELET_COPY } from "@/features/bracelet/copy";
import { useLibraryPanelWheelScroll } from "@/features/bracelet/hooks/use-library-panel-wheel-scroll";
import { cn } from "@/lib/utils";
import { BEAD_LIBRARY_DRAG_TYPE } from "@/features/bracelet/interaction";
import {
  defaultSizeForLibrary,
  formatSizeOfferPrice,
  sizesForLibrary,
} from "@/features/bracelet/library-sizes";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSiteGeneralSettings } from "@/hooks/use-site-settings";
import {
  beadMatchesSearchIndex,
  buildBeadSearchIndex,
  SUB_BEAD_TYPE_ALL,
  type SubBeadTypeTabValue,
} from "@/lib/bead-library-search";
import { getBeadLibraryImageUrl, getBeadLibraryThumbnailStyle, loadProcessedStrandMetrics, resolveStrandDeliveryUrl } from "@/render/bead-crop";
import { useCatalogue } from "@/state/catalogue";
import { useBuilderCatalogue } from "@/state/catalogue/useBuilderCatalogue";
import type { BeadLibraryEntry } from "@/types/beads";
import type { BeadLibrarySizeOffer } from "@/types/bead-library-sizes";

export interface LibraryDragPayload {
  bead: BeadLibraryEntry;
  size: BeadLibrarySizeOffer;
}

interface BeadLibraryProps {
  onSelectBead: (bead: BeadLibraryEntry, size?: BeadLibrarySizeOffer) => void;
  onLibraryDragActiveChange?: (active: boolean) => void;
  onLibraryDragChange?: (active: boolean, payload?: LibraryDragPayload) => void;
  open: boolean;
  onClose: () => void;
  /** Embedded in left config panel (desktop), overlay sheet, or mobile horizontal rail. */
  variant?: "embedded" | "overlay" | "mobile-rail";
  /** Tighter layout for the bracelet left sidebar. */
  compact?: boolean;
}

function dragPayload(bead: BeadLibraryEntry, size: BeadLibrarySizeOffer) {
  return JSON.stringify({ bead, sizeOfferKey: size.offerKey, beadSizeMm: size.sizeMm });
}

/** Bead-only HTML5 drag ghost (card remains the hit target). */
const LIBRARY_DRAG_PREVIEW_PX = 44;

function applyLibraryDragPreview(e: React.DragEvent, imageUrl: string | null) {
  const size = LIBRARY_DRAG_PREVIEW_PX;
  const ghost = document.createElement("div");
  ghost.setAttribute("aria-hidden", "true");
  ghost.style.cssText = [
    "position:fixed",
    "top:-1000px",
    "left:0",
    `width:${size}px`,
    `height:${size}px`,
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "pointer-events:none",
    "background:transparent",
    "border:none",
    "box-shadow:none",
    "overflow:visible",
    "z-index:99999",
  ].join(";");

  if (imageUrl) {
    const img = document.createElement("img");
    img.src = imageUrl;
    img.alt = "";
    img.draggable = false;
    img.style.cssText = [
      "width:100%",
      "height:100%",
      "object-fit:contain",
      "display:block",
      "pointer-events:none",
      "background:transparent",
      "border:none",
      "box-shadow:none",
    ].join(";");
    ghost.appendChild(img);
  }

  document.body.appendChild(ghost);
  e.dataTransfer.setDragImage(ghost, size / 2, size / 2);
  window.setTimeout(() => ghost.remove(), 0);
}

function startLibraryDrag(
  e: React.DragEvent,
  bead: BeadLibraryEntry,
  size: BeadLibrarySizeOffer,
  onLibraryDragActiveChange?: (active: boolean) => void,
  onLibraryDragChange?: (active: boolean, payload?: LibraryDragPayload) => void,
) {
  e.dataTransfer.setData(BEAD_LIBRARY_DRAG_TYPE, dragPayload(bead, size));
  e.dataTransfer.setData("application/json", dragPayload(bead, size));
  e.dataTransfer.effectAllowed = "copy";
  // Resolve alpha metrics before drop so the strand never paints a temporary underscale.
  const url = resolveStrandDeliveryUrl(bead);
  if (url) void loadProcessedStrandMetrics(url);
  onLibraryDragActiveChange?.(true);
  onLibraryDragChange?.(true, { bead, size });
}

interface BeadLibraryCardProps {
  bead: BeadLibraryEntry;
  compact: boolean;
  isMobile: boolean;
  currency: string;
  sizes: BeadLibrarySizeOffer[];
  activeSize: BeadLibrarySizeOffer | undefined;
  selectValue: string;
  onSelectSize: (offerKey: string) => void;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

const BeadLibraryCard = memo(function BeadLibraryCard({
  bead,
  compact,
  isMobile,
  currency,
  sizes,
  activeSize,
  selectValue,
  onSelectSize,
  onClick,
  onDragStart,
  onDragEnd,
}: BeadLibraryCardProps) {
  const img = getBeadLibraryImageUrl(bead);
  const canDrag = !isMobile && !!activeSize;
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const url = resolveStrandDeliveryUrl(bead);
    if (url) void loadProcessedStrandMetrics(url);
  }, [bead]);

  return (
    <div
      className={cn(
        "relative flex flex-col overflow-visible rounded-lg border border-border/60 bg-muted/20",
        isDragging && "opacity-70",
      )}
    >
      <BeadInfoButton bead={bead} />
      {/*
        Use a div (not button): browsers often only start HTML5 drag from images
        inside buttons, which makes the card feel like two different drag sources.
      */}
      <div
        data-bead-library-item
        data-bead-library-drag
        role="button"
        tabIndex={0}
        draggable={canDrag}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        onDragStart={(e) => {
          e.stopPropagation();
          applyLibraryDragPreview(e, img);
          setIsDragging(true);
          onDragStart(e);
        }}
        onDragEnd={(e) => {
          e.stopPropagation();
          setIsDragging(false);
          onDragEnd();
        }}
        className={cn(
          "flex w-full flex-col items-center overflow-hidden rounded-t-lg text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
          !isDragging && "hover:bg-accent hover:text-accent-foreground",
          canDrag && "cursor-grab active:cursor-grabbing",
          compact ? "gap-1 p-1.5" : "gap-1.5 p-2",
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center justify-center bg-transparent",
            compact ? "h-11 w-11" : "h-12 w-12",
          )}
        >
          {img ? (
            <img
              src={img}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              className="pointer-events-none select-none"
              style={getBeadLibraryThumbnailStyle(bead)}
            />
          ) : (
            <Gem className="pointer-events-none h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 w-full">
          <p
            className={cn(
              "pointer-events-none font-medium text-foreground",
              compact ? "line-clamp-2 text-[10px] leading-tight" : "truncate text-xs",
            )}
          >
            {bead.name}
          </p>
        </div>
      </div>
      {activeSize && sizes.length > 1 ? (
        <div className="overflow-hidden rounded-b-lg border-t border-border/50 px-1.5 py-1.5">
          <Select value={selectValue} onValueChange={onSelectSize}>
            <SelectTrigger
              className={cn(
                "h-7 w-full bg-background text-[10px] focus:ring-selection/40",
                compact ? "px-2" : "px-2.5",
              )}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <SelectValue placeholder="Select size" />
            </SelectTrigger>
            <SelectContent>
              {sizes.map((s) => (
                <SelectItem key={s.offerKey} value={s.offerKey} className="text-xs">
                  {s.sizeMm} mm · {formatSizeOfferPrice(s, currency)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : activeSize && sizes.length === 1 ? (
        <div className="overflow-hidden rounded-b-lg border-t border-border/50 px-1.5 py-1.5">
          <p className="px-1 text-center text-[10px] tabular-nums text-muted-foreground">
            {activeSize.sizeMm} mm
          </p>
        </div>
      ) : null}
    </div>
  );
});

const BeadLibrary = ({
  onSelectBead,
  onLibraryDragActiveChange,
  onLibraryDragChange,
  open,
  onClose,
  variant = "overlay",
  compact = false,
}: BeadLibraryProps) => {
  const cat = useCatalogue();
  const builderCatalogue = useBuilderCatalogue();
  const { data: siteSettings } = useSiteGeneralSettings();
  const currency = siteSettings.currencyCode;
  const [search, setSearch] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);
  const [activeSizeMmFilter, setActiveSizeMmFilter] = useState<number | null>(null);
  const [activeBeadTypeId, setActiveBeadTypeId] = useState<string>("");
  const [activeSubBeadTypeId, setActiveSubBeadTypeId] = useState<SubBeadTypeTabValue>(SUB_BEAD_TYPE_ALL);
  const [sizeByBeadId, setSizeByBeadId] = useState<Record<string, string>>({});
  const suppressClickAfterDragRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridAnchorRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const isEmbedded = variant === "embedded";
  const isMobileRail = variant === "mobile-rail";

  useLibraryPanelWheelScroll(scrollRef, !isEmbedded);

  const getScrollElement = useCallback(() => {
    if (!isEmbedded) return scrollRef.current;
    return gridAnchorRef.current?.closest<HTMLElement>("[data-library-scroll-panel]") ?? scrollRef.current;
  }, [isEmbedded]);

  const endLibraryDrag = () => {
    onLibraryDragActiveChange?.(false);
    onLibraryDragChange?.(false);
    suppressClickAfterDragRef.current = true;
    window.setTimeout(() => {
      suppressClickAfterDragRef.current = false;
    }, 0);
  };

  const resolveSizeOffer = useCallback(
    (
      beadId: string,
      sizes: BeadLibrarySizeOffer[],
      def: BeadLibrarySizeOffer | undefined,
    ): BeadLibrarySizeOffer | undefined => {
      const key = sizeByBeadId[beadId];
      if (key) return sizes.find((s) => s.offerKey === key) ?? def;
      return def;
    },
    [sizeByBeadId],
  );

  const handleLibraryClick = useCallback(
    (bead: BeadLibraryEntry, size: BeadLibrarySizeOffer | undefined) => {
      if (suppressClickAfterDragRef.current) return;
      if (!size) return;
      const url = resolveStrandDeliveryUrl(bead);
      if (url) void loadProcessedStrandMetrics(url);
      onSelectBead(bead, size);
    },
    [onSelectBead],
  );

  const activeTypes = useMemo(
    () =>
      [...builderCatalogue.beadTypes].sort(
        (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0),
      ),
    [builderCatalogue.beadTypes],
  );

  useEffect(() => {
    if (!activeTypes.length) {
      if (activeBeadTypeId) setActiveBeadTypeId("");
      return;
    }
    if (!activeBeadTypeId || !builderCatalogue.activeTypeIds.has(activeBeadTypeId)) {
      setActiveBeadTypeId(activeTypes[0]!.id);
      setActiveSubBeadTypeId(SUB_BEAD_TYPE_ALL);
    }
  }, [activeTypes, activeBeadTypeId, builderCatalogue.activeTypeIds]);

  const currentBeadTypeId =
    activeBeadTypeId && builderCatalogue.activeTypeIds.has(activeBeadTypeId)
      ? activeBeadTypeId
      : activeTypes[0]?.id ?? "";
  const currentType = activeTypes.find((t) => t.id === currentBeadTypeId);
  const subTypesEnabled = currentType?.enableSubTypes === true;

  const activeSubTypes = useMemo(
    () =>
      builderCatalogue.subBeadTypes
        .filter((s) => s.beadTypeId === currentBeadTypeId)
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
    [builderCatalogue.subBeadTypes, currentBeadTypeId],
  );

  const currentSubBeadTypeId =
    subTypesEnabled &&
    activeSubBeadTypeId !== SUB_BEAD_TYPE_ALL &&
    activeSubTypes.some((s) => s.id === activeSubBeadTypeId)
      ? activeSubBeadTypeId
      : SUB_BEAD_TYPE_ALL;
  const currentSubType =
    currentSubBeadTypeId === SUB_BEAD_TYPE_ALL
      ? undefined
      : activeSubTypes.find((s) => s.id === currentSubBeadTypeId);

  const railSizeMmOptions = useMemo(() => {
    const set = new Set<number>();
    for (const offer of cat.beadLibrarySizes) set.add(offer.sizeMm);
    return [...set].sort((a, b) => a - b);
  }, [cat.beadLibrarySizes]);

  const handleSelectBeadType = useCallback((typeId: string) => {
    setActiveBeadTypeId(typeId);
    setActiveSubBeadTypeId(SUB_BEAD_TYPE_ALL);
  }, []);

  const beadsForType = useMemo(
    () => builderCatalogue.beadLibraries.filter((b) => b.beadTypeId === currentBeadTypeId),
    [builderCatalogue.beadLibraries, currentBeadTypeId],
  );

  const searchIndex = useMemo(() => buildBeadSearchIndex(beadsForType), [beadsForType]);

  const filtered = useMemo(() => {
    return beadsForType.filter((b) => {
      if (
        subTypesEnabled &&
        currentSubBeadTypeId !== SUB_BEAD_TYPE_ALL &&
        b.subBeadTypeId !== currentSubBeadTypeId
      ) {
        return false;
      }

      const sizes = sizesForLibrary(cat.beadLibrarySizes, b.id);
      if (!sizes.length) return false;

      if (isMobileRail && activeSizeMmFilter !== null) {
        if (!sizes.some((s) => s.sizeMm === activeSizeMmFilter)) return false;
      }

      return beadMatchesSearchIndex(searchIndex, b.id, search);
    });
  }, [
    beadsForType,
    subTypesEnabled,
    currentSubBeadTypeId,
    searchIndex,
    search,
    isMobileRail,
    activeSizeMmFilter,
    cat.beadLibrarySizes,
  ]);

  const gridColumns = compact ? 2 : isMobile ? 1 : 2;
  const rowCount = Math.ceil(filtered.length / gridColumns);
  const rowEstimate = compact ? 122 : 132;

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement,
    estimateSize: () => rowEstimate,
    overscan: 4,
  });

  if (!open && !isEmbedded && !isMobileRail) return null;

  const emptyMessage =
    search.trim().length > 0
      ? BRACELET_COPY.librarySearchEmpty
      : currentSubType
        ? BRACELET_COPY.libraryEmpty(currentSubType.name)
        : currentType
          ? BRACELET_COPY.libraryEmpty(currentType.name)
          : BRACELET_COPY.libraryEmpty("beads");

  if (isMobileRail) {
    return (
      <div className="flex shrink-0 flex-col gap-2">
        <div className="flex items-center gap-2">
          <div
            className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label={BRACELET_COPY.beadTypeFilter}
          >
            {activeTypes.map((t) => {
              const active = t.id === currentBeadTypeId;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => handleSelectBeadType(t.id)}
                  className={cn(
                    "min-h-9 shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/60 text-muted-foreground",
              search.trim() ? "border-primary/40 bg-primary/10 text-foreground" : "bg-muted/30",
            )}
            aria-label="Search collection"
            aria-expanded={searchVisible}
            onClick={() => setSearchVisible((v) => !v)}
          >
            <Search className="h-4 w-4" />
          </button>
        </div>

        {searchVisible ? (
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              id="bead-library-mobile-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search collection…"
              autoFocus
              className="w-full rounded-xl border border-border bg-muted/30 py-2 pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        ) : null}

        {subTypesEnabled && activeSubTypes.length > 0 ? (
          <div className="px-3">
            <div className="flex gap-2 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                role="tab"
                aria-selected={currentSubBeadTypeId === SUB_BEAD_TYPE_ALL}
                onClick={() => setActiveSubBeadTypeId(SUB_BEAD_TYPE_ALL)}
                className={cn(
                  "min-h-9 shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  currentSubBeadTypeId === SUB_BEAD_TYPE_ALL
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:text-foreground",
                )}
              >
                All
              </button>
              {activeSubTypes.map((opt) => {
                const active = currentSubBeadTypeId === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveSubBeadTypeId(opt.id)}
                    className={cn(
                      "min-h-9 shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {opt.name}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="px-3">
          <div className="flex gap-2 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              role="tab"
              aria-selected={activeSizeMmFilter === null}
              onClick={() => setActiveSizeMmFilter(null)}
              className={cn(
                "min-h-9 shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                activeSizeMmFilter === null
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground",
              )}
            >
              All
            </button>
            {railSizeMmOptions.map((mm) => {
              const active = activeSizeMmFilter === mm;
              return (
                <button
                  key={mm}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveSizeMmFilter((cur) => (cur === mm ? null : mm))}
                  className={cn(
                    "min-h-9 shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-muted-foreground hover:text-foreground",
                  )}
                >
                  Size {mm}mm
                </button>
              );
            })}
          </div>
        </div>

        <div
          className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          data-scroll-isolate="true"
        >
          {filtered.length === 0 ? (
            <p className="w-full py-6 text-center text-xs text-muted-foreground">{emptyMessage}</p>
          ) : (
            filtered.map((bead) => {
              const sizes = sizesForLibrary(cat.beadLibrarySizes, bead.id);
              const def = defaultSizeForLibrary(cat.beadLibrarySizes, bead.id);
              const activeSize =
                activeSizeMmFilter !== null
                  ? sizes.find((s) => s.sizeMm === activeSizeMmFilter) ?? def
                  : resolveSizeOffer(bead.id, sizes, def);
              return (
                <button
                  key={bead.id}
                  type="button"
                  data-bead-library-item
                  onClick={() => {
                    if (activeSize) {
                      setSizeByBeadId((prev) => ({
                        ...prev,
                        [bead.id]: activeSize.offerKey,
                      }));
                    }
                    handleLibraryClick(bead, activeSize);
                  }}
                  className="flex w-[4.75rem] shrink-0 flex-col items-stretch overflow-hidden rounded-xl border border-border/60 bg-muted/15 text-left transition active:bg-accent"
                >
                  <span className="h-1 w-full bg-primary/45" aria-hidden />
                  <div className="flex h-14 items-center justify-center bg-transparent px-1 pt-1">
                    {getBeadLibraryImageUrl(bead) ? (
                      <img
                        src={getBeadLibraryImageUrl(bead)!}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="max-h-12 max-w-full object-contain"
                        style={getBeadLibraryThumbnailStyle(bead)}
                      />
                    ) : (
                      <Gem className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 px-1.5 pb-1.5 pt-0.5">
                    <p className="truncate text-[10px] font-medium leading-tight text-foreground">
                      {bead.name}
                    </p>
                    {activeSize ? (
                      <p className="truncate text-[9px] text-muted-foreground">
                        {formatSizeOfferPrice(activeSize, currency)}
                      </p>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  }

  const panelClass = isEmbedded
    ? "flex min-h-0 flex-1 flex-col"
    : isMobile
      ? "surface-elevated fixed bottom-0 left-0 right-0 z-50 flex max-h-[min(70vh,100dvh)] flex-col rounded-t-2xl border-t border-subtle pb-[env(safe-area-inset-bottom)]"
      : "surface-elevated absolute bottom-0 left-0 top-0 z-30 flex w-64 flex-col border-r border-subtle";

  const beadGrid = (
    <div ref={gridAnchorRef} className={cn(compact ? "p-2.5" : "p-2")}>
      {filtered.length === 0 ? (
        <p className="px-2 py-8 text-center text-xs leading-relaxed text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="relative w-full" style={{ height: rowVirtualizer.getTotalSize() }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const rowStart = virtualRow.index * gridColumns;
            const rowBeads = filtered.slice(rowStart, rowStart + gridColumns);

            return (
              <div
                key={virtualRow.key}
                className={cn(
                  "absolute left-0 right-0 grid px-0",
                  compact ? "grid-cols-2 gap-2.5" : "grid-cols-1 gap-2 sm:grid-cols-2",
                )}
                style={{
                  top: virtualRow.start,
                  height: virtualRow.size,
                }}
              >
                {rowBeads.map((bead) => {
                  const sizes = sizesForLibrary(cat.beadLibrarySizes, bead.id);
                  const def = defaultSizeForLibrary(cat.beadLibrarySizes, bead.id);
                  const activeSize = resolveSizeOffer(bead.id, sizes, def);
                  const selectValue = activeSize?.offerKey ?? def?.offerKey ?? "";

                  return (
                    <BeadLibraryCard
                      key={bead.id}
                      bead={bead}
                      compact={compact}
                      isMobile={isMobile}
                      currency={currency}
                      sizes={sizes}
                      activeSize={activeSize}
                      selectValue={selectValue}
                      onSelectSize={(offerKey) => {
                        setSizeByBeadId((prev) => ({ ...prev, [bead.id]: offerKey }));
                        const next = sizes.find((s) => s.offerKey === offerKey);
                        if (next) onSelectBead(bead, next);
                      }}
                      onClick={() => handleLibraryClick(bead, activeSize)}
                      onDragStart={(e) =>
                        activeSize &&
                        startLibraryDrag(
                          e,
                          bead,
                          activeSize,
                          onLibraryDragActiveChange,
                          onLibraryDragChange,
                        )
                      }
                      onDragEnd={endLibraryDrag}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const filterSelectTriggerClass = cn(
    "h-8 w-full bg-background text-xs focus:ring-selection/40",
    compact ? "px-2" : "px-2.5",
  );

  const libraryFilters = (
    <div
      className={cn(
        "shrink-0 space-y-2 border-b border-border/60",
        compact ? "px-2.5 py-2.5" : "px-3 py-3",
      )}
    >
      <div className="space-y-1">
        <label className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {BRACELET_COPY.beadTypeFilter}
        </label>
        <Select value={currentBeadTypeId} onValueChange={handleSelectBeadType}>
          <SelectTrigger className={filterSelectTriggerClass}>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {activeTypes.map((t) => (
              <SelectItem key={t.id} value={t.id} className="text-xs">
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {subTypesEnabled && activeSubTypes.length > 0 ? (
        <div className="space-y-1">
          <label className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {BRACELET_COPY.subBeadTypeFilter}
          </label>
          <SubBeadTypeTabs
            options={activeSubTypes}
            value={currentSubBeadTypeId}
            onChange={setActiveSubBeadTypeId}
          />
        </div>
      ) : null}
    </div>
  );

  const libraryBody = (
    <>
      {libraryFilters}

      <div className={cn("shrink-0 border-b border-border/60", compact ? "p-2.5" : "p-3")}>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search collection…"
            className="w-full rounded-md border border-border bg-muted/40 py-2 pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {beadGrid}
    </>
  );

  return (
    <>
      {!isEmbedded && isMobile && open && (
        <div className="fixed inset-0 z-40 bg-[hsl(var(--overlay))]" onClick={onClose} aria-hidden />
      )}
      <div className={panelClass}>
        {!compact && !isEmbedded ? (
          <div className="flex shrink-0 justify-end border-b border-border px-2 py-2">
            <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close collection">
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : null}

        {isEmbedded ? (
          libraryBody
        ) : (
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            data-scroll-isolate="true"
            data-library-scroll-panel="true"
          >
            {libraryBody}
          </div>
        )}

        <div className="flex shrink-0 items-start gap-2 border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{isMobile ? BRACELET_COPY.selectedBeadHint : BRACELET_COPY.libraryDragHint}</span>
        </div>
      </div>
    </>
  );
};

export default BeadLibrary;
