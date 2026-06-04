import { useMemo, useState } from "react";
import { Search, X, Info, Gem } from "lucide-react";

import { useCatalogue } from "@/state/catalogue";
import type { BeadLibraryEntry, BeadTypeEntry } from "@/types/beads";
import { useSiteGeneralSettings } from "@/hooks/use-site-settings";
import { useIsMobile } from "@/hooks/use-mobile";
import { getBeadDisplayImageUrl, getStrandBeadImageStyle } from "@/render/bead-crop";
import { BRACELET_COPY } from "@/features/bracelet/copy";

interface BeadLibraryProps {
  onSelectBead: (bead: BeadLibraryEntry) => void;
  open: boolean;
  onClose: () => void;
}

function formatPrice(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

const BeadLibrary = ({ onSelectBead, open, onClose }: BeadLibraryProps) => {
  const cat = useCatalogue();
  const { data: siteSettings } = useSiteGeneralSettings();
  const currency = siteSettings.currencyCode;
  const [search, setSearch] = useState("");
  const [activeBeadTypeId, setActiveBeadTypeId] = useState<string>("");
  const isMobile = useIsMobile();

  const activeTypes = useMemo(
    () => [...cat.beadTypes].filter((t) => t.isActive !== false).sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
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

  const tabLabel = (t: BeadTypeEntry) => t.name;

  const emptyMessage =
    search.trim().length > 0
      ? BRACELET_COPY.librarySearchEmpty
      : currentType
        ? BRACELET_COPY.libraryEmpty(currentType.name)
        : "No beads in this category yet.";

  if (!open) return null;

  return (
    <>
      {isMobile && <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />}
      <div
        className={
          isMobile
            ? "fixed bottom-0 left-0 right-0 z-50 flex max-h-[min(70vh,100dvh)] flex-col rounded-t-2xl border-t border-border bg-card shadow-xl pb-[env(safe-area-inset-bottom)]"
            : "absolute left-0 top-0 bottom-0 z-20 flex w-60 flex-col border-r border-border bg-card/95 backdrop-blur-sm"
        }
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="font-display text-sm font-semibold tracking-wide">Bead Library</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label="Close bead library"
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
                currentBeadTypeId === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {tabLabel(t)}
            </button>
          ))}
        </div>

        <div className="border-b border-border p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search beads…"
              className="w-full rounded-md border border-border bg-muted/40 py-2 pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-2 py-8 text-center text-xs leading-relaxed text-muted-foreground">{emptyMessage}</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {filtered.map((bead) => {
                const img = getBeadDisplayImageUrl(bead);
                const typeName = currentType?.name ?? bead.beadTypeSlug ?? "";
                return (
                  <button
                    key={bead.id}
                    type="button"
                    draggable={!isMobile}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/json", JSON.stringify({ bead }));
                    }}
                    onClick={() => onSelectBead(bead)}
                    className="flex min-h-[88px] flex-col items-center gap-1 rounded-lg border border-border/60 bg-muted/30 p-2 transition hover:border-primary/40 hover:bg-muted/60 active:scale-[0.98]"
                  >
                    <div className="flex h-12 w-12 items-center justify-center overflow-visible bg-transparent">
                      {img ? (
                        <img
                          src={img}
                          alt=""
                          className="max-h-full max-w-full"
                          style={getStrandBeadImageStyle(bead)}
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded border border-dashed border-border bg-muted">
                          <Gem className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <span className="line-clamp-2 text-center text-[9px] font-medium leading-tight text-foreground">
                      {bead.name}
                    </span>
                    <span className="text-[8px] text-muted-foreground">
                      {typeName} · {formatPrice(bead.price, currency)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-start gap-2 border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            {isMobile
              ? "Choose a bead, then tap an open circle on the strand."
              : "Click to add or drag beads onto the strand."}
          </span>
        </div>
      </div>
    </>
  );
};

export default BeadLibrary;
