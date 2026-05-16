import { useState, useCallback, useEffect, useRef } from "react";
import { Library, RotateCcw, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import BeadLibrary from "@/components/BeadLibrary";
import SortableCircularStrand from "@/components/SortableCircularStrand";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  calculateBeadCount,
  calculateBeadPrice,
  type BeadSize,
  type PlacedBead,
  type CrystalBead,
  type CharmItem,
  type SpacerItem,
} from "@/lib/luxe-data";

type SelectedItem =
  | { kind: "crystal"; crystal: CrystalBead }
  | { kind: "charm"; charm: CharmItem }
  | { kind: "spacer"; spacer: SpacerItem }
  | null;

interface BraceletBuilderProps {
  onPriceChange: (price: number) => void;
}

const BEAD_SIZES: BeadSize[] = [6, 8, 10];

function useCanvasSize(isMobile: boolean, twinning: boolean, libraryOpen: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [strandSize, setStrandSize] = useState(400);

  useEffect(() => {
    const measure = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      if (isMobile) {
        if (twinning) {
          const maxByWidth = (w - 24) / 2;
          const maxByHeight = h - 80;
          setStrandSize(Math.max(160, Math.min(240, maxByWidth, maxByHeight)));
        } else {
          const maxByWidth = w - 32;
          const maxByHeight = h - 40;
          setStrandSize(Math.max(220, Math.min(360, maxByWidth, maxByHeight)));
        }
      } else {
        const sidebarOffset = libraryOpen ? 260 : 0;
        const availableW = w - sidebarOffset - 48;
        const strandCount = twinning ? 2 : 1;
        const maxByWidth = (availableW - (twinning ? 32 : 0)) / strandCount;
        const maxByHeight = h - 40;
        setStrandSize(Math.max(280, Math.min(480, maxByWidth, maxByHeight)));
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isMobile, twinning, libraryOpen]);

  return { containerRef, strandSize };
}

function getItemPrice(item: PlacedBead): number {
  if (item.type === "crystal" && item.crystal) {
    return calculateBeadPrice(item.crystal.price, item.beadSize);
  }
  if (item.type === "charm" && item.charm) {
    return item.charm.price;
  }
  if (item.type === "spacer" && item.spacer) {
    return item.spacer.price;
  }
  return 0;
}

function getSelectedItemLabel(sel: SelectedItem): string {
  if (!sel) return "";
  if (sel.kind === "crystal") return sel.crystal.name;
  if (sel.kind === "charm") return sel.charm.name;
  if (sel.kind === "spacer") return sel.spacer.name;
  return "";
}

function getSelectedItemImage(sel: SelectedItem): string {
  if (!sel) return "";
  if (sel.kind === "crystal") return sel.crystal.image;
  if (sel.kind === "charm") return sel.charm.image;
  if (sel.kind === "spacer") return sel.spacer.image;
  return "";
}

function buildPlacedBead(sel: SelectedItem, position: number, defaultBeadSize: BeadSize): PlacedBead | null {
  if (!sel) return null;
  if (sel.kind === "crystal") {
    return { position, type: "crystal", crystal: sel.crystal, beadSize: defaultBeadSize };
  }
  if (sel.kind === "charm") {
    return { position, type: "charm", charm: sel.charm, beadSize: defaultBeadSize };
  }
  if (sel.kind === "spacer") {
    return { position, type: "spacer", spacer: sel.spacer, beadSize: defaultBeadSize };
  }
  return null;
}

function buildPlacedBeadFromDrop(data: any, position: number, defaultBeadSize: BeadSize): PlacedBead | null {
  if (data.type === "crystal") {
    return { position, type: "crystal", crystal: data.item, beadSize: defaultBeadSize };
  }
  if (data.type === "charm") {
    return { position, type: "charm", charm: data.item, beadSize: defaultBeadSize };
  }
  if (data.type === "spacer") {
    return { position, type: "spacer", spacer: data.item, beadSize: defaultBeadSize };
  }
  return null;
}

const BraceletBuilder = ({ onPriceChange }: BraceletBuilderProps) => {
  const [wristSizeA, setWristSizeA] = useState(16);
  const [wristSizeB, setWristSizeB] = useState(16);
  const isMobile = useIsMobile();

  const clampWristSize = (value: number) => {
    const clamped = Math.max(14, Math.min(20, value));
    return Math.round(clamped * 2) / 2;
  };

  const handleWristSizeAChange = (value: number) => {
    setWristSizeA(clampWristSize(value));
  };

  const handleWristSizeBChange = (value: number) => {
    setWristSizeB(clampWristSize(value));
  };
  const [defaultBeadSize, setDefaultBeadSize] = useState<BeadSize>(8);
  const [placedBeadsA, setPlacedBeadsA] = useState<PlacedBead[]>([]);
  const [placedBeadsB, setPlacedBeadsB] = useState<PlacedBead[]>([]);
  const [twinning, setTwinning] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(() => !window.matchMedia("(max-width: 767px)").matches);
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);

  const beadCountA = calculateBeadCount(wristSizeA, defaultBeadSize);
  const beadCountB = calculateBeadCount(wristSizeB, defaultBeadSize);

  const { containerRef, strandSize } = useCanvasSize(isMobile, twinning, libraryOpen);

  const updatePrice = useCallback(
    (beadsA: PlacedBead[], beadsB: PlacedBead[], twin: boolean) => {
      const priceA = beadsA.reduce((s, b) => s + getItemPrice(b), 0);
      const priceB = twin ? beadsB.reduce((s, b) => s + getItemPrice(b), 0) : 0;
      onPriceChange(priceA + priceB);
    },
    [onPriceChange]
  );

  const handleSlotClick = (bracelet: "A" | "B", position: number, beadSize: BeadSize) => {
    const placedBeads = bracelet === "A" ? placedBeadsA : placedBeadsB;
    const setPlacedBeads = bracelet === "A" ? setPlacedBeadsA : setPlacedBeadsB;

    const existing = placedBeads.find((b) => b.position === position);
    let updated: PlacedBead[];

    if (existing && !selectedItem) {
      updated = placedBeads.filter((b) => b.position !== position);
    } else if (selectedItem) {
      const newBead = buildPlacedBead(selectedItem, position, defaultBeadSize);
      if (!newBead) return;
      updated = existing
        ? placedBeads.map((b) => (b.position === position ? newBead : b))
        : [...placedBeads, newBead];
    } else {
      setLibraryOpen(true);
      return;
    }

    setPlacedBeads(updated);
    if (bracelet === "A") updatePrice(updated, placedBeadsB, twinning);
    else updatePrice(placedBeadsA, updated, twinning);
  };

  const handleBeadDrop = (bracelet: "A" | "B", position: number, data: any) => {
    const placedBeads = bracelet === "A" ? placedBeadsA : placedBeadsB;
    const setPlacedBeads = bracelet === "A" ? setPlacedBeadsA : setPlacedBeadsB;

    const existing = placedBeads.find((b) => b.position === position);
    const newItem = buildPlacedBeadFromDrop(data, position, defaultBeadSize);
    if (!newItem) return;

    const updated = existing
      ? placedBeads.map((b) => (b.position === position ? newItem : b))
      : [...placedBeads, newItem];

    setPlacedBeads(updated);
    if (bracelet === "A") updatePrice(updated, placedBeadsB, twinning);
    else updatePrice(placedBeadsA, updated, twinning);
  };

  const handleBeadsReorder = (bracelet: "A" | "B", reorderedBeads: PlacedBead[]) => {
    const setPlacedBeads = bracelet === "A" ? setPlacedBeadsA : setPlacedBeadsB;
    setPlacedBeads(reorderedBeads);
    if (bracelet === "A") updatePrice(reorderedBeads, placedBeadsB, twinning);
    else updatePrice(placedBeadsA, reorderedBeads, twinning);
  };

  const handleBeadSizeChange = (newSize: BeadSize) => {
    setDefaultBeadSize(newSize);
  };

  const autoPlaceItem = (newBead: PlacedBead) => {
    let targetBracelet: "A" | "B" = "A";
    let nextPos = -1;

    for (let i = 0; i < beadCountA; i++) {
      if (!placedBeadsA.find(b => b.position === i)) { nextPos = i; break; }
    }

    if (nextPos === -1 && twinning) {
      targetBracelet = "B";
      for (let i = 0; i < beadCountB; i++) {
        if (!placedBeadsB.find(b => b.position === i)) { nextPos = i; break; }
      }
    }

    if (nextPos !== -1) {
      const placed = { ...newBead, position: nextPos };
      if (targetBracelet === "A") {
        const updated = [...placedBeadsA, placed];
        setPlacedBeadsA(updated);
        updatePrice(updated, placedBeadsB, twinning);
      } else {
        const updated = [...placedBeadsB, placed];
        setPlacedBeadsB(updated);
        updatePrice(placedBeadsA, updated, twinning);
      }
    }
  };

  const handleSelectCrystal = (bead: CrystalBead) => {
    const sel: SelectedItem = { kind: "crystal", crystal: bead };
    setSelectedItem(sel);
    autoPlaceItem({ position: 0, type: "crystal", crystal: bead, beadSize: defaultBeadSize });
    if (isMobile) setLibraryOpen(false);
  };

  const handleSelectCharm = (charm: CharmItem) => {
    const sel: SelectedItem = { kind: "charm", charm };
    setSelectedItem(sel);
    autoPlaceItem({ position: 0, type: "charm", charm, beadSize: defaultBeadSize });
    if (isMobile) setLibraryOpen(false);
  };

  const handleSelectSpacer = (spacer: SpacerItem) => {
    const sel: SelectedItem = { kind: "spacer", spacer };
    setSelectedItem(sel);
    autoPlaceItem({ position: 0, type: "spacer", spacer, beadSize: defaultBeadSize });
    if (isMobile) setLibraryOpen(false);
  };

  const handleReset = () => {
    setPlacedBeadsA([]);
    setPlacedBeadsB([]);
    setSelectedItem(null);
    updatePrice([], [], twinning);
  };

  const handleToggleTwinning = () => {
    const next = !twinning;
    setTwinning(next);
    if (!next) {
      setPlacedBeadsB([]);
      updatePrice(placedBeadsA, [], next);
    } else {
      updatePrice(placedBeadsA, placedBeadsB, next);
    }
  };

  const itemImage = getSelectedItemImage(selectedItem);

  return (
    <div className="relative flex-1 w-full h-full flex flex-col animate-fade-in">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-4 px-3 sm:px-6 py-2.5 sm:py-4 border-b border-border">
        {/* Wrist size I */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <label className="text-[10px] sm:text-xs text-muted-foreground font-body uppercase tracking-wider">
            {twinning ? "Wrist I" : "Wrist"}
          </label>
          <input
            type="number"
            value={wristSizeA}
            onChange={(e) => handleWristSizeAChange(Number(e.target.value))}
            className="w-14 sm:w-16 px-2 py-1 sm:py-1.5 text-sm border border-border rounded-md bg-background font-body focus:outline-none focus:ring-1 focus:ring-primary"
            min={14}
            max={20}
            step={0.5}
          />
          <span className="text-[10px] sm:text-xs text-muted-foreground">cm</span>
        </div>

        {twinning && (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <label className="text-[10px] sm:text-xs text-muted-foreground font-body uppercase tracking-wider">Wrist II</label>
            <input
              type="number"
              value={wristSizeB}
              onChange={(e) => handleWristSizeBChange(Number(e.target.value))}
              className="w-14 sm:w-16 px-2 py-1 sm:py-1.5 text-sm border border-border rounded-md bg-background font-body focus:outline-none focus:ring-1 focus:ring-primary"
              min={14}
              max={20}
              step={0.5}
            />
            <span className="text-[10px] sm:text-xs text-muted-foreground">cm</span>
          </div>
        )}

        {/* Bead size selector */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <label className="text-[10px] sm:text-xs text-muted-foreground font-body uppercase tracking-wider hidden sm:inline">Bead Size</label>
          <div className="flex rounded-md border border-border overflow-hidden">
            {BEAD_SIZES.map((s) => (
              <button
                key={s}
                onClick={() => handleBeadSizeChange(s)}
                className={`px-2.5 sm:px-3 py-1 text-xs font-body transition-colors ${
                  defaultBeadSize === s ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {s}mm
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
          {selectedItem && !isMobile && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-sm font-body cursor-pointer hover:bg-muted/60 transition-colors"
              title="Click to deselect"
              onClick={() => setSelectedItem(null)}
            >
              {itemImage ? (
                <div
                  className="w-4 h-4 rounded-full"
                  style={{
                    background: `url("${itemImage}${itemImage.startsWith('data:') ? '' : '?v=2'}") center / cover no-repeat`
                  }}
                />
              ) : (
                <div className="w-4 h-4 rounded-full bg-muted-foreground/20" />
              )}
              <span>{getSelectedItemLabel(selectedItem)}</span>
              <span className="text-xs text-muted-foreground">&#x2715;</span>
            </div>
          )}
          <Button variant="luxe-outline" size="sm" onClick={() => setLibraryOpen(!libraryOpen)} className="text-xs sm:text-sm">
            <Library className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Library</span>
          </Button>
          <Button variant="luxe-outline" size="sm" onClick={handleToggleTwinning} className="text-xs sm:text-sm">
            <Copy className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{twinning ? "Single" : "Twin"}</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={handleReset} className="h-8 w-8 sm:h-9 sm:w-9">
            <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </Button>
        </div>
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        className={`flex-1 relative flex items-center justify-center gap-4 sm:gap-8 p-3 sm:p-6 overflow-hidden transition-all duration-300 ${
          libraryOpen && !isMobile ? "lg:pl-[260px]" : ""
        }`}
      >
        <BeadLibrary
          open={libraryOpen}
          onSelectCrystal={handleSelectCrystal}
          onSelectCharm={handleSelectCharm}
          onSelectSpacer={handleSelectSpacer}
          onClose={() => setLibraryOpen(false)}
        />

        <SortableCircularStrand
          beadCount={beadCountA}
          placedBeads={placedBeadsA}
          onBeadsReorder={(beads) => handleBeadsReorder("A", beads)}
          onSlotClick={(pos, size) => handleSlotClick("A", pos, size)}
          onBeadDrop={(pos, bead) => handleBeadDrop("A", pos, bead)}
          label={twinning ? "Bracelet I" : undefined}
          wristSize={wristSizeA}
          size={strandSize}
        />

        {twinning && (
          <SortableCircularStrand
            beadCount={beadCountB}
            placedBeads={placedBeadsB}
            onBeadsReorder={(beads) => handleBeadsReorder("B", beads)}
            onSlotClick={(pos, size) => handleSlotClick("B", pos, size)}
            onBeadDrop={(pos, bead) => handleBeadDrop("B", pos, bead)}
            label="Bracelet II"
            wristSize={wristSizeB}
            size={strandSize}
          />
        )}
      </div>

      {/* Info bar */}
      <div className="px-3 sm:px-6 py-2 sm:py-3 border-t border-border flex items-center gap-3 sm:gap-6 text-[10px] sm:text-xs text-muted-foreground font-body">
        {!twinning ? (
          <>
            <span>{placedBeadsA.length} of {beadCountA} beads placed</span>
            <span>Base size: {defaultBeadSize}mm</span>
            {placedBeadsA.length > 0 && !isMobile && (
              <span>Sizes used: {[...new Set(placedBeadsA.map(b => b.beadSize))].sort().join(', ')}mm</span>
            )}
          </>
        ) : (
          <>
            <span>I: {placedBeadsA.length}/{beadCountA}</span>
            <span>II: {placedBeadsB.length}/{beadCountB}</span>
            <span>Total: {placedBeadsA.length + placedBeadsB.length} beads</span>
          </>
        )}
      </div>
    </div>
  );
};

export default BraceletBuilder;
