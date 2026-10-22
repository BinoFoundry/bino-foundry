import { useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { WristSizeEntry } from "@/types/wrist-sizes";

import { BRACELET_COPY } from "../copy";
import { formatWristSizeCm, wristSizeDescriptor } from "../wrist-size-display";
import { activeWristSizes } from "../wrist-sizes";

// Each size is a fine medallion framed by a turned bamboo rim: a warm tan band
// with fine concentric grain lines, like a lathed wooden bezel around the pale
// face. Choosing one rings it in deep olive and lifts it.
function BeadRing({ selected }: { selected: boolean }) {
  const cx = 50;
  const cy = 50;
  const rInner = 41.5;
  const rOuter = 46.8;

  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full transition-all duration-200"
      style={{
        filter: selected
          ? "drop-shadow(0 12px 20px rgba(74,60,30,0.16))"
          : "drop-shadow(0 3px 9px rgba(74,60,30,0.07))",
      }}
    >
      {/* disc face */}
      <circle cx={cx} cy={cy} r={47} fill={selected ? "#f8f1e3" : "#fdfbf5"} />

      {/* a simple warm bamboo band with two crisp edges, so it reads as a
          turned wooden rim without any fussy texture */}
      <circle
        cx={cx}
        cy={cy}
        r={(rInner + rOuter) / 2}
        fill="none"
        stroke="#d3b983"
        strokeWidth={rOuter - rInner}
      />
      <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="#a9894f" strokeWidth={0.7} opacity={0.7} />
      <circle cx={cx} cy={cy} r={rInner} fill="none" stroke="#f3e8cc" strokeWidth={0.8} opacity={0.85} />

      {/* deep-olive outline rings the whole medallion when chosen */}
      {selected ? <circle cx={cx} cy={cy} r={47} fill="none" stroke="#4b4d2e" strokeWidth={1.5} /> : null}
    </svg>
  );
}

export interface WristSizeStepProps {
  sizes: WristSizeEntry[];
  selectedId: string | null;
  onSelect: (entry: WristSizeEntry) => void;
  onConfirm: () => void;
  className?: string;
}

export function WristSizeStep({
  sizes,
  selectedId,
  onSelect,
  onConfirm,
  className,
}: WristSizeStepProps) {
  const options = activeWristSizes(sizes);
  const canConfirm = !!selectedId && options.length > 0;
  const maxCm = options.length ? Math.max(...options.map((o) => o.sizeCm)) : 1;
  // The sizes sit on a rotary dial you can either tap or spin by dragging;
  // whichever size lands under the top marker is selected. It's larger on
  // desktop so it fills the space.
  const isMobile = useIsMobile();
  const dialMult = isMobile ? 0.66 : 0.9;
  const n = options.length;
  const step = n ? 360 / n : 0;
  const selectedIndex = options.findIndex((o) => o.id === selectedId);
  const spin = "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)";

  // the dial's live rotation; starts aligned to the current selection
  const [rotation, setRotation] = useState(selectedIndex >= 0 ? -selectedIndex * step : 0);
  const [dragging, setDragging] = useState(false);
  const rotationRef = useRef(rotation);
  const dialRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ lastAngle: number; moved: boolean; total: number; tappedIndex: number | null } | null>(null);
  const suppressClick = useRef(false);

  const setRot = (value: number) => {
    rotationRef.current = value;
    setRotation(value);
  };
  // pick the rotation equivalent to `target` that is closest to the current one
  const nearest = (target: number) => target + 360 * Math.round((rotationRef.current - target) / 360);
  const pointerAngle = (e: React.PointerEvent) => {
    const el = dialRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  };
  const onDialPointerDown = (e: React.PointerEvent) => {
    suppressClick.current = false;
    const el = (e.target as HTMLElement).closest("[data-well]");
    const tappedIndex = el ? Number(el.getAttribute("data-well")) : null;
    dragRef.current = { lastAngle: pointerAngle(e), moved: false, total: 0, tappedIndex };
    setDragging(true);
    dialRef.current?.setPointerCapture(e.pointerId);
  };
  const onDialPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const a = pointerAngle(e);
    let inc = a - d.lastAngle;
    if (inc > 180) inc -= 360;
    else if (inc < -180) inc += 360;
    d.lastAngle = a;
    d.total += Math.abs(inc);
    if (d.total > 6) d.moved = true; // past this it's a spin, not a tap
    setRot(rotationRef.current + inc);
  };
  const onDialPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    if (!d || !n) return;
    suppressClick.current = true; // swallow the click that may follow
    if (d.moved) {
      // spun: snap whichever size is nearest the top marker
      const idx = Math.round(-rotationRef.current / step);
      setRot(-idx * step);
      onSelect(options[((idx % n) + n) % n]);
    } else if (d.tappedIndex != null) {
      // tapped a size: rotate it up to the marker
      setRot(nearest(-d.tappedIndex * step));
      onSelect(options[d.tappedIndex]);
    }
  };

  // keyboard activation (Enter/Space) still selects via the button's onClick
  const selectAt = (entry: WristSizeEntry, index: number) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    setRot(nearest(-index * step));
    onSelect(entry);
  };

  const renderWell = (entry: WristSizeEntry, mult = 1, uniform = false, onClickOverride?: () => void) => {
    const selected = selectedId === entry.id;
    const sizeText = formatWristSizeCm(entry.sizeCm);
    const descriptor = wristSizeDescriptor(entry.label, entry.sizeCm);
    const scale = uniform ? 1 : entry.sizeCm / maxCm;
    const dimRem = 8 * scale * mult;
    const numberRem = Math.max(1.05, 1.66 * scale * mult);
    return (
      <button
        key={entry.id}
        type="button"
        role="radio"
        aria-checked={selected}
        aria-label={descriptor ? `${sizeText} centimetres, ${descriptor}` : `${sizeText} centimetres`}
        onClick={onClickOverride ?? (() => onSelect(entry))}
        style={{ width: `${dimRem}rem`, height: `${dimRem}rem` }}
        className={cn(
          "group relative flex shrink-0 items-center justify-center rounded-full transition-all duration-200 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a8a5e] focus-visible:ring-offset-4 focus-visible:ring-offset-transparent",
          selected ? "scale-[1.06]" : "hover:scale-[1.04]",
        )}
      >
        <BeadRing selected={selected} />
        <span className="relative flex flex-col items-center justify-center leading-none">
          <span
            className="font-serif font-medium leading-none"
            style={{ color: selected ? "#404225" : "#646345", fontSize: `${numberRem}rem` }}
          >
            {sizeText}
          </span>
          <span className="mt-1 text-[9px] font-medium uppercase tracking-[0.22em]" style={{ color: "#8f8a6a" }}>
            cm
          </span>
        </span>
      </button>
    );
  };

  if (!options.length) {
    return (
      <div className={cn("surface-card w-full max-w-lg p-10 text-center", className)}>
        <p className="text-sm text-muted-foreground">{BRACELET_COPY.wristSizesUnavailable}</p>
      </div>
    );
  }

  return (
    <div className={cn("w-full max-w-3xl px-2", className)}>
      <header className="mb-8 space-y-3 text-center sm:mb-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: "#8a8a5e" }}>
          {BRACELET_COPY.wristOnboardingTitle}
        </p>
        <h1 className="font-serif text-3xl font-medium sm:text-[2.4rem]" style={{ color: "#3f4a26", lineHeight: 1.1 }}>
          {BRACELET_COPY.wristStepTitle}
        </h1>
        <p className="mx-auto max-w-md text-sm font-light sm:text-base" style={{ color: "#6b6a4a" }}>
          {BRACELET_COPY.wristStepSubtitle}
        </p>
      </header>

      <div role="radiogroup" aria-label="Wrist size">
        <div
          ref={dialRef}
          className={cn(
            "relative mx-auto aspect-square w-full cursor-grab touch-none select-none active:cursor-grabbing",
            isMobile ? "max-w-[21rem]" : "max-w-[30rem]",
          )}
          style={{ touchAction: "none" }}
          onPointerDown={onDialPointerDown}
          onPointerMove={onDialPointerMove}
          onPointerUp={onDialPointerUp}
          onPointerCancel={onDialPointerUp}
        >
            {/* fixed marker at the top of the dial */}
            <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2" aria-hidden="true">
              <svg width="20" height="13" viewBox="0 0 20 13">
                <path d="M2 2 L18 2 L10 12 Z" fill="#4b4d2e" />
              </svg>
            </div>
            {/* the rotating ring of sizes */}
            <div className="absolute inset-0" style={{ transform: `rotate(${rotation}deg)`, transition: dragging ? "none" : spin }}>
              {options.map((entry, i) => {
                const angle = (-90 + i * step) * (Math.PI / 180);
                const radiusPct = 31; // distance of each well from the dial centre
                const left = 50 + radiusPct * Math.cos(angle);
                const top = 50 + radiusPct * Math.sin(angle);
                return (
                  <div
                    key={entry.id}
                    data-well={i}
                    className="absolute"
                    style={{ left: `${left}%`, top: `${top}%`, transform: "translate(-50%, -50%)" }}
                  >
                    {/* counter-rotate so the number stays upright as the ring turns */}
                    <div style={{ transform: `rotate(${-rotation}deg)`, transition: dragging ? "none" : spin }}>
                      {renderWell(entry, dialMult, true, () => selectAt(entry, i))}
                    </div>
                  </div>
                );
              })}
            </div>
        </div>
      </div>

      {!selectedId ? (
        <p className="mt-8 text-center text-[13px] leading-relaxed sm:text-sm" style={{ color: "#6b6a4a" }} aria-live="polite">
          {BRACELET_COPY.wristStepSelectPrompt}
        </p>
      ) : null}

      <div className="mt-7 flex justify-center">
        <Button
          type="button"
          size="lg"
          disabled={!canConfirm}
          onClick={onConfirm}
          className="group h-12 w-full max-w-sm rounded-full disabled:opacity-60"
        >
          {BRACELET_COPY.wristStepContinue}
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Button>
      </div>
    </div>
  );
}
