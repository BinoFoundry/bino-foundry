import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WristSizeEntry } from "@/types/wrist-sizes";

import { BRACELET_COPY } from "../copy";
import { activeWristSizes } from "../wrist-sizes";
import { WristSizePickerCards } from "./WristSizePickerCards";

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

  if (!options.length) {
    return (
      <div
        className={cn(
          "surface-card w-full max-w-lg p-10 text-center",
          className,
        )}
      >
        <p className="text-sm text-muted-foreground">{BRACELET_COPY.wristSizesUnavailable}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "surface-card w-full max-w-3xl p-6 sm:p-8",
        className,
      )}
    >
      <header className="mb-5 space-y-2 text-center sm:mb-6">
        <p className="label-eyebrow">
          {BRACELET_COPY.wristOnboardingTitle}
        </p>
        <h1 className="type-feature text-foreground sm:text-h2">
          {BRACELET_COPY.wristStepTitle}
        </h1>
        <p className="type-body-lg mx-auto max-w-sm font-light text-muted-foreground">
          {BRACELET_COPY.wristStepSubtitle}
        </p>
      </header>

      <WristSizePickerCards
        sizes={options}
        selectedId={selectedId}
        onSelect={onSelect}
        scrollable={options.length > 16}
        className="mb-4 sm:mb-5"
      />

      {!selectedId ? (
        <p
          className="mb-4 text-center text-[13px] leading-relaxed text-muted-foreground sm:mb-5 sm:text-sm"
          aria-live="polite"
        >
          {BRACELET_COPY.wristStepSelectPrompt}
        </p>
      ) : null}

      <Button
        type="button"
        size="lg"
        disabled={!canConfirm}
        onClick={onConfirm}
        className="group h-11 w-full sm:h-12"
      >
        {BRACELET_COPY.wristStepContinue}
        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </Button>
    </div>
  );
}
