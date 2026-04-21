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
} from "@/lib/luxe-data";

type SelectedItem =
  | { kind: "crystal"; crystal: CrystalBead }
  | null;

interface BraceletBuilderProps {
  onPriceChange: (price: number) => void;
}

const BEAD_SIZES: BeadSize[] = [6, 8, 10];

function useCanvasSize(isMobile: boolean, twinning: boolean, libraryOpen: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [strandSize, setStrandSize] = useState(320);

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
          setStrandSize(Math.max(140, Math.min(200, maxByWidth, maxByHeight)));
        } else {
          const maxByWidth = w - 32;
          const maxByHeight = h - 40;
          setStrandSize(Math.max(180, Math.min(300, maxByWidth, maxByHeight)));
        }
      } else {
        const sidebarOffset = libraryOpen ? 300 : 0;
        const availableW = w - sidebarOffset - 48;
        const strandCount = twinning ? 2 : 1;
        const maxByWidth = (availableW - (twinning ? 32 : 0)) / strandCount;
        const maxByHeight = h - 40;
        setStrandSize(Math.max(200, Math.min(360, maxByWidth, maxByHeight)));
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isMobile, twinning, libraryOpen]);

  return { containerRef, strandSize };
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
      const calculateItemPrice = (item: PlacedBead) => {
        if (item.type === 'crystal' && item.crystal) {
          return calculateBeadPrice(item.crystal.price, item.beadSize);
        }
        return 0;
      };

      const priceA = beadsA.reduce((s, b) => s + calculateItemPrice(b), 0);
      const priceB = twin ? beadsB.reduce((s, b) => s + calculateItemPrice(b), 0) : 0;
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
      let newBead: PlacedBead;
      if (selectedItem.kind === "crystal") {
        newBead = { position, type: "crystal", crystal: selectedItem.crystal, beadSize: defaultBeadSize };
      } else {
        return;
      }
      updated = existing
        ? placedBeads.map((b) => (b.position === position ? newBead : b))
        : [...placedBeads, newBead];
    } else {
      setLibraryOpen(true);
      return;
    }

    setPlacedBeads(updated);

    if (bracelet === "A") {
      updatePrice(updated, placedBeadsB, twinning);
    } else {
      updatePrice(placedBeadsA, updated, twinning);
    }
  };

  const handleBeadDrop = (bracelet: "A" | "B", position: number, data: any) => {
    const placedBeads = bracelet === "A" ? placedBeadsA : placedBeadsB;
    const setPlacedBeads = bracelet === "A" ? setPlacedBeadsA : setPlacedBeadsB;

    const existing = placedBeads.find((b) => b.position === position);

    let newItem: PlacedBead;
    if (data.type === "crystal") {
      newItem = { position, type: "crystal", crystal: data.item, beadSize: defaultBeadSize };
    } else {
      return;
    }

    const updated = existing
      ? placedBeads.map((b) => (b.position === position ? newItem : b))
      : [...placedBeads, newItem];

    setPlacedBeads(updated);

    if (bracelet === "A") {
      updatePrice(updated, placedBeadsB, twinning);
    } else {
      updatePrice(placedBeadsA, updated, twinning);
    }
  };

  const handleBeadsReorder = (bracelet: "A" | "B", reorderedBeads: PlacedBead[]) => {
    const setPlacedBeads = bracelet === "A" ? setPlacedBeadsA : setPlacedBeadsB;
    setPlacedBeads(reorderedBeads);

    if (bracelet === "A") {
      updatePrice(reorderedBeads, placedBeadsB, twinning);
    } else {
      updatePrice(placedBeadsA, reorderedBeads, twinning);
    }
  };

  const handleBeadSizeChange = (newSize: BeadSize) => {
    setDefaultBeadSize(newSize);
  };

  const autoPlaceItem = (type: "crystal", item: any) => {
    let targetBracelet: "A" | "B" = "A";
    let nextPos = -1;

    for (let i = 0; i < beadCountA; i++) {
      if (!placedBeadsA.find(b => b.position === i)) {
        nextPos = i;
        break;
      }
    }

    if (nextPos === -1 && twinning) {
      targetBracelet = "B";
      for (let i = 0; i < beadCountB; i++) {
        if (!placedBeadsB.find(b => b.position === i)) {
          nextPos = i;
          break;
        }
      }
    }

    if (nextPos !== -1) {
      let newBead: PlacedBead;
      if (type === "crystal") {
        newBead = { position: nextPos, type: "crystal", crystal: item, beadSize: defaultBeadSize };
      } else {
        return;
      }

      if (targetBracelet === "A") {
        const updated = [...placedBeadsA, newBead];
        setPlacedBeadsA(updated);
        updatePrice(updated, placedBeadsB, twinning);
      } else {
        const updated = [...placedBeadsB, newBead];
        setPlacedBeadsB(updated);
        updatePrice(placedBeadsA, updated, twinning);
      }
    }
  };

  const handleSelectBead = (bead: CrystalBead) => {
    setSelectedItem({ kind: "crystal", crystal: bead });
    autoPlaceItem("crystal", bead);
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

        {/* Wrist size II */}
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
              {selectedItem.kind === "crystal" && (
                <div
                  className="w-4 h-4 rounded-full"
                  style={{
                    background: selectedItem.crystal.image ? `url("${selectedItem.crystal.image}${selectedItem.crystal.image.startsWith('data:') ? '' : '?v=2'}") center / cover no-repeat` : "hsl(var(--muted))"
                  }}
                />
              )}
              <span>
                {selectedItem.kind === "crystal" ? selectedItem.crystal.name : ""}
              </span>
              <span className="text-xs text-muted-foreground">&#x2715;</span>
            </div>
          )}
          <Button variant="luxe-outline" size="sm" onClick={() => setLibraryOpen(!libraryOpen)} className="text-xs sm:text-sm">
            <Library className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Crystals</span>
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
          libraryOpen && !isMobile ? "lg:pl-[300px]" : ""
        }`}
      >
        <BeadLibrary
          open={libraryOpen}
          onSelectBead={handleSelectBead}
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
