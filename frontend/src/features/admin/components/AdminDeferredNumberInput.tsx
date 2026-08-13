import { useEffect, useRef, useState, type KeyboardEvent } from "react";

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
  /** Multiply stored value for display (e.g. 100 for percent). Prefer 1 for 1:1 fields. */
  displayScale?: number;
  decimals?: number;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
  /**
   * When true (default), out-of-range values are clamped on commit.
   * When false, the draft is kept and onRangeError is called — value is not changed silently.
   */
  clampOnCommit?: boolean;
  onRangeError?: (message: string) => void;
  onClearError?: () => void;
  /** Notifies parent when the field gains / loses focus (for form-state isolation). */
  onEditingChange?: (editing: boolean) => void;
}

/**
 * Numeric field with temporary draft state.
 * Empty / partial input is allowed while focused; validate on blur or Enter.
 * While focused, parent `value` updates never overwrite the in-progress draft.
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
  clampOnCommit = true,
  onRangeError,
  onClearError,
  onEditingChange,
}: AdminDeferredNumberInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const draftRef = useRef<string | null>(null);
  const focusedRef = useRef(false);
  const scaled = value * displayScale;
  const shown = draft !== null ? draft : formatCommitted(scaled, decimals);

  // Sync from committed value only when the field is not being edited.
  useEffect(() => {
    if (focusedRef.current || draftRef.current !== null) return;
    setDraft(null);
  }, [value, displayScale]);

  const setDraftBoth = (next: string | null) => {
    draftRef.current = next;
    setDraft(next);
  };

  const commit = () => {
    if (disabled) {
      setDraftBoth(null);
      onClearError?.();
      return;
    }
    const currentDraft = draftRef.current;
    if (currentDraft === null) return;
    const trimmed = currentDraft.trim();
    if (
      trimmed === "" ||
      trimmed === "-" ||
      trimmed === "." ||
      trimmed === "-." ||
      trimmed === "+"
    ) {
      // Empty / incomplete on blur → revert display to last committed value (no parent write).
      setDraftBoth(null);
      onClearError?.();
      return;
    }
    const parsed = parseLocaleNumber(trimmed);
    if (!Number.isFinite(parsed)) {
      setDraftBoth(null);
      onClearError?.();
      return;
    }
    const stored = parsed / displayScale;
    if (stored < min || stored > max) {
      if (!clampOnCommit) {
        const minLabel = Number.isFinite(min) ? String(min) : "−∞";
        const maxLabel = Number.isFinite(max) ? String(max) : "∞";
        onRangeError?.(`Must be between ${minLabel} and ${maxLabel}.`);
        // Keep draft so the typed value stays visible.
        return;
      }
      const clamped = Math.min(max, Math.max(min, stored));
      onClearError?.();
      onCommit(clamped);
      setDraftBoth(null);
      return;
    }
    onClearError?.();
    // Commit first so parent/local form state updates before draft clears.
    onCommit(stored);
    setDraftBoth(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDraftBoth(null);
      onClearError?.();
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
      onFocus={() => {
        focusedRef.current = true;
        onEditingChange?.(true);
      }}
      onChange={(e) => {
        setDraftBoth(e.target.value);
        onClearError?.();
      }}
      onBlur={() => {
        commit();
        focusedRef.current = false;
        onEditingChange?.(false);
      }}
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
        clampOnCommit
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
