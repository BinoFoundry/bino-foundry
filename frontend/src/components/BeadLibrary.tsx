import { useMemo, useState } from "react";
import { Search, X, Info, Gem } from "lucide-react";

import { BRACELET_COPY } from "@/features/bracelet/copy";
import { BEAD_LIBRARY_DRAG_TYPE } from "@/features/bracelet/interaction";
import {
  defaultSizeForLibrary,
  formatSizeOfferPrice,
  sizesForLibrary,
} from "@/features/bracelet/library-sizes";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSiteGeneralSettings } from "@/hooks/use-site-settings";
import { getBeadDisplayImageUrl, getStrandBeadImageStyle } from "@/render/bead-crop";
import { useCatalogue } from "@/state/catalogue";
import type { BeadLibraryEntry, BeadTypeEntry } from "@/types/beads";
import type { BeadLibrarySizeOffer } from "@/types/bead-library-sizes";

interface BeadLibraryProps {
  onSelectBead: (bead: BeadLibraryEntry, size?: BeadLibrarySizeOffer) => void;
  onLibraryDragActiveChange?: (active: boolean) => void;
  open: boolean;
  onClose: () => void;
}

function dragPayload(bead: BeadLibraryEntry, size: BeadLibrarySizeOffer) {
  return JSON.stringify({ bead, sizeOfferKey: size.offerKey, beadSizeMm: size.sizeMm });
}

function startLibraryDrag(
  e: React.DragEvent,
  bead: BeadLibraryEntry,
  size: BeadLibrarySizeOffer,
  onLibraryDragActiveChange?: (active: boolean) => void,
) {
  e.dataTransfer.setData(BEAD_LIBRARY_DRAG_TYPE, dragPayload(bead, size));
  e.dataTransfer.setData("application/json", dragPayload(bead, size));
  e.dataTransfer.effectAllowed = "copy";
  onLibraryDragActiveChange?.(true);
}

const BeadLibrary = ({ onSelectBead, onLibraryDragActiveChange, open, onClose }: BeadLibraryProps) => {
  const cat = useCatalogue();
  const { data: siteSettings } = useSiteGeneralSettings();
  const currency = siteSettings.currencyCode;
  const [search, setSearch] = useState("");
  const [activeBeadTypeId, setActiveBeadTypeId] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const activeTypes = useMemo(
    () =>
      [...cat.beadTypes]
        .filter((t) => t.isActive !== false)
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
    [cat.beadTypes],
  );

  const currentBeadTypeId = activeBeadTypeId || activeTypes[0]?.id || "";
  const currentType = activeTypes.find((t) => t.id === currentBeadTypeId);

  const filtered = useMemo(() => {
    return cat.beadLibraries.filter((b) => {
      if (b.isActive === false) return false;
      if (b.beadTypeId !== currentBeadTypeId) return false;
      return b.name.toLowerCase().includes(search.toLowerCase());
    });
  }, [cat.beadLibraries, currentBeadTypeId, search]);

  if (!open) return null;

  const emptyMessage =
    search.trim().length > 0
      ? BRACELET_COPY.librarySearchEmpty
      : currentType
        ? BRACELET_COPY.libraryEmpty(currentType.name)
        : BRACELET_COPY.libraryEmpty("beads");

  return (
    <>
      {isMobile && <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />}
      <div
        className={
          isMobile
            ? "fixed bottom-0 left-0 right-0 z-50 flex max-h-[min(70vh,100dvh)] flex-col rounded-t-2xl border-t border-border bg-card shadow-xl pb-[env(safe-area-inset-bottom)]"
            : "absolute left-0 top-0 bottom-0 z-20 flex w-64 flex-col border-r border-border bg-card/95 backdrop-blur-sm"
        }
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="font-display text-sm font-semibold tracking-wide">{BRACELET_COPY.libraryTitle}</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label="Close collection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-2">
          {activeTypes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveBeadTypeId(t.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider ${
                currentBeadTypeId === t.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        <div className="border-b border-border p-3">
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

        <div
          className="flex-1 overflow-y-auto p-2"
          data-scroll-isolate="true"
          onWheel={(e) => e.stopPropagation()}
        >
          {filtered.length === 0 ? (
            <p className="px-2 py-8 text-center text-xs leading-relaxed text-muted-foreground">{emptyMessage}</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((bead) => {
                const img = getBeadDisplayImageUrl(bead);
                const sizes = sizesForLibrary(cat.beadLibrarySizes, bead.id);
                const def = defaultSizeForLibrary(cat.beadLibrarySizes, bead.id);
                const expanded = expandedId === bead.id;
                const fromPrice = def ? formatSizeOfferPrice(def, currency) : "";

                return (
                  <div
                    key={bead.id}
                    className="rounded-lg border border-border/60 bg-muted/20 overflow-hidden"
                  >
                    <button
                      type="button"
                      data-bead-library-item
                      draggable={!isMobile && !!def}
                      onDragStart={(e) => def && startLibraryDrag(e, bead, def, onLibraryDragActiveChange)}
                      onDragEnd={() => onLibraryDragActiveChange?.(false)}
                      onClick={() => {
                        if (sizes.length > 1) {
                          setExpandedId(expanded ? null : bead.id);
                        }
                        onSelectBead(bead, def);
                      }}
                      className="flex w-full items-center gap-2 p-2 text-left transition hover:bg-muted/50"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center">
                        {img ? (
                          <img
                            src={img}
                            alt=""
                            className="max-h-full max-w-full"
                            style={getStrandBeadImageStyle(bead)}
                          />
                        ) : (
                          <Gem className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-foreground">{bead.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {sizes.length > 1
                            ? `${sizes.length} sizes · ${fromPrice ? BRACELET_COPY.fromPrice(fromPrice) : ""}`
                            : def
                              ? `${def.sizeMm} mm · ${formatSizeOfferPrice(def, currency)}`
                              : ""}
                        </p>
                      </div>
                    </button>
                    {(expanded || sizes.length <= 4) && sizes.length > 0 ? (
                      <div className="flex flex-wrap gap-1 border-t border-border/50 px-2 py-2">
                        {sizes.map((s) => (
                          <button
                            key={s.offerKey}
                            type="button"
                            data-bead-library-item
                            draggable={!isMobile}
                            onDragStart={(e) => {
                              e.stopPropagation();
                              startLibraryDrag(e, bead, s, onLibraryDragActiveChange);
                            }}
                            onDragEnd={() => onLibraryDragActiveChange?.(false)}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectBead(bead, s);
                            }}
                            className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-foreground hover:border-primary/50 hover:bg-primary/5"
                            title={`Drag ${s.label} onto your bracelet`}
                          >
                            {s.sizeMm} mm · {formatSizeOfferPrice(s, currency)}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-start gap-2 border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{isMobile ? BRACELET_COPY.selectedBeadHint : BRACELET_COPY.libraryDragHint}</span>
        </div>
      </div>
    </>
  );
};

export default BeadLibrary;
