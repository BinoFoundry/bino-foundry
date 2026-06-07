import { type PlacedBead, type BeadSize, type CrystalBead } from "@/lib/luxe-data";

interface CircularStrandProps {
  beadCount: number;
  placedBeads: PlacedBead[];
  onSlotClick: (position: number, beadSize: BeadSize) => void;
  onBeadDrop?: (position: number, bead: CrystalBead) => void;
  label?: string;
  wristSize: number;
}

function getBeadBackground(bead: PlacedBead | null | undefined): string {
  if (!bead) return "hsl(var(--muted))";
  if (bead.type === "crystal" && bead.crystal?.image) {
    const isDataUrl = bead.crystal.image.startsWith("data:");
    return `url("${bead.crystal.image}${isDataUrl ? "" : "?v=2"}") center / cover no-repeat`;
  }
  if (bead.type === "charm" && bead.charm?.image) {
    return `url("${bead.charm.image}") center / cover no-repeat`;
  }
  if (bead.type === "spacer" && bead.spacer?.image) {
    return `url("${bead.spacer.image}") center / cover no-repeat`;
  }
  if (bead.type === "charm") return "hsl(var(--gold-light))";
  if (bead.type === "spacer") return "hsl(0 0% 82%)";
  return "hsl(var(--muted))";
}

function getBeadLabel(bead: PlacedBead): string {
  if (bead.type === "crystal" && bead.crystal) return `${bead.crystal.name} (${bead.beadSize}mm)`;
  if (bead.type === "charm" && bead.charm) return bead.charm.name;
  if (bead.type === "spacer" && bead.spacer) return bead.spacer.name;
  return `Slot`;
}

const CircularStrand = ({ beadCount, placedBeads, onSlotClick, onBeadDrop, label, wristSize }: CircularStrandProps) => {
  const canvasSize = 320;
  const center = canvasSize / 2;

  const getBeadPx = (sz: number) => sz === 6 ? 22 : sz === 8 ? 28 : 36;
  const maxBeadPx = getBeadPx(10);
  const radius = center - maxBeadPx / 2 - 6;

  const slots = Array.from({ length: beadCount }, (_, i) => {
    const angle = (2 * Math.PI * i) / beadCount - Math.PI / 2;
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);
    const placed = placedBeads.find((b) => b.position === i);
    const beadPixelSize = placed ? getBeadPx(placed.beadSize) : 10;
    return { index: i, x, y, placed, beadPixelSize };
  });

  return (
    <div className="flex flex-col items-center gap-3">
      {label && <span className="text-xs font-body text-muted-foreground uppercase tracking-widest">{label}</span>}
      <div className="relative" style={{ width: canvasSize, height: canvasSize }}>
        <svg className="absolute inset-0" width={canvasSize} height={canvasSize}>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth="1"
            strokeDasharray="3 4"
            opacity="0.4"
          />
        </svg>
        {slots.map((slot) => {
          const borderRadius = slot.placed?.type === "charm" ? "4px" : "50%";
          return (
            <button
              key={slot.index}
              onClick={() => onSlotClick(slot.index, slot.placed?.beadSize || 8)}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (onBeadDrop) {
                  try {
                    const beadData = JSON.parse(e.dataTransfer.getData("application/json"));
                    onBeadDrop(slot.index, beadData);
                  } catch (err) {
                    console.error("Failed to parse bead data:", err);
                  }
                }
              }}
              className={`absolute border transition-all duration-150 group ${slot.placed ? "hover:scale-105 active:scale-95" : "hover:opacity-60"}`}
              style={{
                width: slot.beadPixelSize,
                height: slot.beadPixelSize,
                left: slot.x - slot.beadPixelSize / 2,
                top: slot.y - slot.beadPixelSize / 2,
                background: getBeadBackground(slot.placed),
                borderColor: slot.placed ? "transparent" : "hsl(var(--border))",
                boxShadow: slot.placed
                  ? "0 1px 3px rgba(0,0,0,0.18), 0 4px 10px rgba(0,0,0,0.12), inset 0 1px 1px rgba(255,255,255,0.25)"
                  : "none",
                opacity: slot.placed ? 1 : 0.35,
                borderRadius,
              }}
              title={
                slot.placed
                  ? getBeadLabel(slot.placed)
                  : `Slot ${slot.index + 1}`
              }
            >
              {slot.placed && (
                <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  {slot.placed.type === "crystal" ? `${slot.placed.beadSize}mm` : getBeadLabel(slot.placed)}
                </span>
              )}
            </button>
          );
        })}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="type-price text-2xl text-foreground">{placedBeads.length}</p>
            <p className="text-[10px] text-muted-foreground font-body uppercase tracking-wider">of {beadCount}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CircularStrand;
