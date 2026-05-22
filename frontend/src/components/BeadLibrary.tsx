import { useMemo, useState } from "react";
import { Search, X, Info, Gem } from "lucide-react";

import { useCatalogue } from "@/state/catalogue";
import type { BeadLibraryEntry, BeadTypeEntry } from "@/types/beads";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { getBeadDisplayImageUrl, getStrandBeadImageStyle } from "@/render/bead-crop";

interface BeadLibraryProps {
  onSelectBead: (bead: BeadLibraryEntry) => void;
  open: boolean;
  onClose: () => void;
}

const BeadLibrary = ({ onSelectBead, open, onClose }: BeadLibraryProps) => {
  const cat = useCatalogue();
  const [search, setSearch] = useState("");
  const [selectedTypeId, setSelectedTypeId] = useState<string>("all");
  const [activeBeadTypeId, setActiveBeadTypeId] = useState<string>("");
  const isMobile = useIsMobile();

  const activeTypes = useMemo(
    () => [...cat.beadTypes].filter((t) => t.isActive !== false).sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
    [cat.beadTypes],
  );

  const currentBeadTypeId = activeBeadTypeId || activeTypes[0]?.id || "";

  const subtypeOptions = useMemo(() => {
    const beads = cat.beadLibraries.filter((b) => b.beadTypeId === currentBeadTypeId);
    const legacyIds = new Set<string>();
    for (const b of beads) {
      const meta = b.metadata as Record<string, unknown> | undefined;
      const legacy =
        (meta?.legacyCrystalTypeId as string) ||
        (meta?.legacyCharmTypeId as string) ||
        (meta?.legacySpacerTypeId as string);
      if (legacy) legacyIds.add(legacy);
    }
    return Array.from(legacyIds);
  }, [cat.beadLibraries, currentBeadTypeId]);

  const filtered = useMemo(() => {
    return cat.beadLibraries.filter((b) => {
      if (b.beadTypeId !== currentBeadTypeId) return false;
      const matchesSearch = b.name.toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) return false;
      if (selectedTypeId === "all") return true;
      const meta = b.metadata as Record<string, unknown> | undefined;
      const legacy =
        (meta?.legacyCrystalTypeId as string) ||
        (meta?.legacyCharmTypeId as string) ||
        (meta?.legacySpacerTypeId as string);
      return legacy === selectedTypeId;
    });
  }, [cat.beadLibraries, currentBeadTypeId, search, selectedTypeId]);

  const tabLabel = (t: BeadTypeEntry) => t.name;

  if (!open) return null;

  return (
    <>
      {isMobile && <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />}
      <div
        className={
          isMobile
            ? "fixed bottom-0 left-0 right-0 z-50 max-h-[70vh] rounded-t-2xl border-t border-border bg-card shadow-xl flex flex-col"
            : "absolute left-0 top-0 bottom-0 z-20 w-60 border-r border-border bg-card/95 backdrop-blur-sm flex flex-col"
        }
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="font-display text-sm font-semibold tracking-wide">Bead Library</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-2">
          {activeTypes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setActiveBeadTypeId(t.id);
                setSelectedTypeId("all");
              }}
              className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-wider ${
                currentBeadTypeId === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {tabLabel(t)}
            </button>
          ))}
        </div>

        <div className="space-y-2 border-b border-border p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search beads…"
              className="w-full rounded-md border border-border bg-muted/40 py-2 pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          {subtypeOptions.length > 0 ? (
            <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Subtype" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subtypes</SelectItem>
                {subtypeOptions.map((id) => (
                  <SelectItem key={id} value={id}>
                    Legacy subtype
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">No beads in this category.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {filtered.map((bead) => {
                const img = getBeadDisplayImageUrl(bead);
                return (
                  <Tooltip key={bead.id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        draggable={!isMobile}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("application/json", JSON.stringify({ bead }));
                        }}
                        onClick={() => onSelectBead(bead)}
                        className="flex flex-col items-center gap-1 rounded-lg border border-border/60 bg-muted/30 p-2 transition hover:border-primary/40 hover:bg-muted/60"
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
                        <span className="line-clamp-2 text-center text-[9px] leading-tight">{bead.name}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[200px] text-xs">
                      <p className="font-medium">{bead.name}</p>
                      <p className="text-muted-foreground">${bead.price.toFixed(2)}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-start gap-2 border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          <span>Click or drag beads onto the strand. Crop-ready assets render cleaner on the bracelet.</span>
        </div>
      </div>
    </>
  );
};

export default BeadLibrary;
