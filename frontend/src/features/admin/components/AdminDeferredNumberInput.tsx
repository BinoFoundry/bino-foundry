import { useEffect, useState, type KeyboardEvent } from "react";

import { parseLocaleNumber } from "@/lib/bead-size-format";

import { adminFieldClass } from "./admin-styles";

function formatCommitted(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return "";
  const fixed = value.toFixed(decimals);
  return fixed.replace(/\.?0+$/, "") || "0";
}

export interface AdminDeferredNumberInputProps {
  value: number;
  onCommit: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Multiply stored value for display (e.g. 100 for percent). */
  displayScale?: number;
  decimals?: number;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
}

/**
 * Numeric field with temporary draft state.
 * Empty / partial input is allowed while focused; validate + clamp on blur or Enter.
 */
export function AdminDeferredNumberInput({
  value,
  onCommit,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  step,
  displayScale = 1,
  decimals = 2,
  disabled = false,
  className,
  id,
  "aria-label": ariaLabel,
}: AdminDeferredNumberInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const scaled = value * displayScale;
  const shown = draft !== null ? draft : formatCommitted(scaled, decimals);

  useEffect(() => {
    setDraft(null);
  }, [value, displayScale]);

  const commit = () => {
    if (draft === null) return;
    const trimmed = draft.trim();
    if (
      trimmed === "" ||
      trimmed === "-" ||
      trimmed === "." ||
      trimmed === "-." ||
      trimmed === "+"
    ) {
      setDraft(null);
      return;
    }
    const parsed = parseLocaleNumber(trimmed);
    if (!Number.isFinite(parsed)) {
      setDraft(null);
      return;
    }
    const stored = parsed / displayScale;
    const clamped = Math.min(max, Math.max(min, stored));
    setDraft(null);
    if (Math.abs(clamped - value) > 1e-9) onCommit(clamped);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDraft(null);
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      disabled={disabled}
      aria-label={ariaLabel}
      className={className ?? adminFieldClass()}
      value={shown}
      step={step}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
    />
  );
}

export interface AdminNumberWithSliderProps extends AdminDeferredNumberInputProps {
  sliderStep?: number;
}

/** Deferred numeric input paired with a range slider; both share the committed value. */
export function AdminNumberWithSlider({
  value,
  onCommit,
  min = 0,
  max = 1,
  step = 0.01,
  sliderStep,
  displayScale = 1,
  decimals = 2,
  disabled = false,
  className,
  id,
  "aria-label": ariaLabel,
}: AdminNumberWithSliderProps) {
  const sliderValue = Math.min(max, Math.max(min, value));
  return (
    <div className="space-y-1.5">
      <AdminDeferredNumberInput
        id={id}
        value={value}
        onCommit={onCommit}
        min={min}
        max={max}
        step={step}
        displayScale={displayScale}
        decimals={decimals}
        disabled={disabled}
        className={className}
        aria-label={ariaLabel}
      />
      <input
        type="range"
        min={min * displayScale}
        max={max * displayScale}
        step={(sliderStep ?? step) * displayScale}
        disabled={disabled}
        className="w-full accent-primary"
        value={sliderValue * displayScale}
        onChange={(e) => onCommit(Number(e.target.value) / displayScale)}
        aria-label={ariaLabel ? `${ariaLabel} slider` : undefined}
      />
    </div>
  );
}
