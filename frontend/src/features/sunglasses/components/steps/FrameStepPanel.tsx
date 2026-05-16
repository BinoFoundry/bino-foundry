import { cn } from "@/lib/utils";
import type { FrameOption } from "@/lib/luxe-data";
import type { FrameColorEntry } from "@/types/sunglasses-catalog";

interface FrameStepPanelProps {
  frames: FrameOption[];
  frameColors: FrameColorEntry[];
  selectedFrameId: string;
  selectedFrameColor: { name: string; hex: string };
  onSelectFrame: (id: string) => void;
  onSelectColor: (color: { name: string; hex: string }) => void;
}

export function FrameStepPanel({
  frames,
  frameColors,
  selectedFrameId,
  selectedFrameColor,
  onSelectFrame,
  onSelectColor,
}: FrameStepPanelProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-lg font-bold text-foreground">Choose your frame</h3>
        <p className="mt-1 text-sm text-muted-foreground">Select a style, then pick a frame colour.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {frames.map((frame) => {
          const active = frame.id === selectedFrameId;
          return (
            <button
              key={frame.id}
              type="button"
              onClick={() => onSelectFrame(frame.id)}
              className={cn(
                "rounded-2xl border p-4 text-left transition-all",
                active
                  ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                  : "border-border bg-card hover:border-primary/40",
              )}
            >
              <p className="font-semibold text-foreground">{frame.name}</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{frame.description}</p>
              <p className="mt-2 text-sm font-bold text-primary">${frame.price}</p>
            </button>
          );
        })}
        {frames.length === 0 && (
          <p className="text-sm text-muted-foreground">No frames in catalogue yet.</p>
        )}
      </div>

      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Frame colour</p>
        <div className="flex flex-wrap gap-3">
          {frameColors.map((color) => {
            const active = selectedFrameColor.hex === color.hex;
            return (
              <button
                key={color.id}
                type="button"
                title={color.name}
                onClick={() => onSelectColor({ name: color.name, hex: color.hex })}
                className={cn(
                  "h-10 w-10 rounded-full border-2 transition-transform",
                  active ? "scale-110 border-primary" : "border-border hover:scale-105",
                )}
                style={{ backgroundColor: color.hex }}
                aria-label={color.name}
                aria-pressed={active}
              />
            );
          })}
        </div>
        {frameColors.length === 0 && (
          <p className="text-sm text-muted-foreground">No frame colours configured in admin.</p>
        )}
        <p className="mt-2 text-sm text-muted-foreground">{selectedFrameColor.name}</p>
      </div>
    </div>
  );
}
