import { useMemo, useRef, useState, useCallback, memo } from "react";
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
import { BRACELET_COPY } from "@/features/bracelet/copy";
import { isBeadVisibleInBuilder } from "@/features/bracelet/unavailable-bead";
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
import { getBeadLibraryImageUrl, getBeadLibraryThumbnailStyle } from "@/render/bead-crop";
import { useCatalogue } from "@/state/catalogue";
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
  /** Embedded in left config panel (desktop) or overlay sheet (mobile). */
  variant?: "embedded" | "overlay";
  /** Tighter layout for the bracelet left sidebar. */
  compact?: boolean;
}

function dragPayload(bead: BeadLibraryEntry, size: BeadLibrarySizeOffer) {
  return JSON.stringify({ bead, sizeOfferKey: size.offerKey, beadSizeMm: size.sizeMm });
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

  return (
    <div className="relative flex flex-col overflow-visible rounded-lg border border-border/60 bg-muted/20">
      <BeadInfoButton bead={bead} />
      <button
        type="button"
        data-bead-library-item
        draggable={!isMobile && !!activeSize}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={onClick}
        className={cn(
          "flex w-full flex-col items-center overflow-hidden rounded-t-lg text-center transition hover:bg-accent hover:text-accent-foreground",
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
              style={getBeadLibraryThumbnailStyle(bead)}
            />
          ) : (
            <Gem className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 w-full">
          <p
            className={cn(
              "font-medium text-foreground",
              compact ? "line-clamp-2 text-[10px] leading-tight" : "truncate text-xs",
            )}
          >
            {bead.name}
          </p>
        </div>
      </button>
      {activeSize && sizes.length > 0 ? (
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
  const { data: siteSettings } = useSiteGeneralSettings();
  const currency = siteSettings.currencyCode;
  const [search, setSearch] = useState("");
  const [activeBeadTypeId, setActiveBeadTypeId] = useState<string>("");
  const [activeSubBeadTypeId, setActiveSubBeadTypeId] = useState<string>("");
  const [sizeByBeadId, setSizeByBeadId] = useState<Record<string, string>>({});
  const suppressClickAfterDragRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridAnchorRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const isEmbedded = variant === "embedded";

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
      onSelectBead(bead, size);
    },
    [onSelectBead],
  );

  const activeTypes = useMemo(
    () =>
      [...cat.beadTypes]
        .filter((t) => t.isActive !== false)
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
    [cat.beadTypes],
  );

  const currentBeadTypeId = activeBeadTypeId || activeTypes[0]?.id || "";
  const currentType = activeTypes.find((t) => t.id === currentBeadTypeId);

  const activeSubTypes = useMemo(
    () =>
      cat.subBeadTypes
        .filter((s) => s.beadTypeId === currentBeadTypeId && s.isActive !== false)
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
    [cat.subBeadTypes, currentBeadTypeId],
  );

  const currentSubBeadTypeId =
    activeSubBeadTypeId && activeSubTypes.some((s) => s.id === activeSubBeadTypeId)
      ? activeSubBeadTypeId
      : activeSubTypes[0]?.id ?? "";
  const currentSubType = activeSubTypes.find((s) => s.id === currentSubBeadTypeId);

  const handleSelectBeadType = useCallback(
    (typeId: string) => {
      setActiveBeadTypeId(typeId);
      setActiveSubBeadTypeId((prev) => {
        const subs = cat.subBeadTypes
          .filter((s) => s.beadTypeId === typeId && s.isActive !== false)
          .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
        if (prev && subs.some((s) => s.id === prev)) return prev;
        return subs[0]?.id ?? "";
      });
    },
    [cat.subBeadTypes],
  );

  const builderStatusByCode = useMemo(
    () => new Map(cat.beadAvailabilityStatuses.map((s) => [s.code, { showInBuilder: s.showInBuilder }])),
    [cat.beadAvailabilityStatuses],
  );

  const filtered = useMemo(() => {
    return cat.beadLibraries.filter((b) => {
      if (!isBeadVisibleInBuilder(b, builderStatusByCode)) return false;
      if (!currentSubBeadTypeId) return false;
      if (b.subBeadTypeId !== currentSubBeadTypeId) return false;
      return b.name.toLowerCase().includes(search.toLowerCase());
    });
  }, [cat.beadLibraries, builderStatusByCode, currentSubBeadTypeId, search]);

  const gridColumns = compact ? 2 : isMobile ? 1 : 2;
  const rowCount = Math.ceil(filtered.length / gridColumns);
  const rowEstimate = compact ? 118 : 132;

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement,
    estimateSize: () => rowEstimate,
    overscan: 4,
  });

  if (!open && !isEmbedded) return null;

  const emptyMessage =
    search.trim().length > 0
      ? BRACELET_COPY.librarySearchEmpty
      : currentSubType
        ? BRACELET_COPY.libraryEmpty(currentSubType.name)
        : currentType
          ? BRACELET_COPY.libraryEmpty(currentType.name)
          : BRACELET_COPY.libraryEmpty("beads");

  const panelClass = isEmbedded
    ? "flex min-h-0 flex-1 flex-col"
    : isMobile
      ? "surface-elevated fixed bottom-0 left-0 right-0 z-50 flex max-h-[min(70vh,100dvh)] flex-col rounded-t-2xl border-t border-subtle pb-[env(safe-area-inset-bottom)]"
      : "surface-elevated absolute bottom-0 left-0 top-0 z-30 flex w-64 flex-col border-r border-subtle";

  const beadGrid = (
    <div ref={gridAnchorRef} className="p-2">
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
                className={cn("absolute left-0 right-0 grid gap-2 px-0", compact ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2")}
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
        compact ? "px-2 py-2" : "px-3 py-3",
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

      {activeSubTypes.length > 0 ? (
        <div className="space-y-1">
          <label className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {BRACELET_COPY.subBeadTypeFilter}
          </label>
          <Select value={currentSubBeadTypeId} onValueChange={setActiveSubBeadTypeId}>
            <SelectTrigger className={filterSelectTriggerClass}>
              <SelectValue placeholder="Select sub-type" />
            </SelectTrigger>
            <SelectContent>
              {activeSubTypes.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-xs">
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );

  const libraryBody = (
    <>
      {libraryFilters}

      <div className={cn("shrink-0 border-b border-border/60", compact ? "p-2" : "p-3")}>
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
