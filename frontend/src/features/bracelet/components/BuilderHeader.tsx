import { Gem, Glasses } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { cn } from "@/lib/utils";

import { BRACELET_COPY } from "../copy";
import type { BuilderStepId } from "../builder-steps";
import { BUILDER_STEPS } from "../builder-steps";

interface BuilderHeaderProps {
  activeStep: BuilderStepId;
  pieceCount: number;
  twinning?: boolean;
  onToggleTwinning?: () => void;
  className?: string;
}

export function BuilderHeader({
  activeStep,
  pieceCount,
  twinning = false,
  onToggleTwinning,
  className,
}: BuilderHeaderProps) {
  const navigate = useNavigate();
  const stepLabel = BUILDER_STEPS.find((s) => s.id === activeStep)?.label ?? "";

  return (
    <header
      className={cn(
        "builder-workspace-header flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-subtle px-4 py-3 sm:px-6 sm:py-4",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="label-eyebrow mb-0.5">{BRACELET_COPY.builderWorkspaceLabel}</p>
        <h2 className="type-h3 text-base sm:text-h3">{BRACELET_COPY.builderTitle}</h2>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {stepLabel}
          {pieceCount > 0 ? ` · ${BRACELET_COPY.productPieces(pieceCount)}` : ""}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div
          className="inline-flex rounded-full border border-[hsl(var(--control-border))] bg-[hsl(var(--control-bg))] p-0.5"
          role="group"
          aria-label="Builder mode"
        >
          <button
            type="button"
            aria-current="page"
            className="type-label inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-primary-foreground"
          >
            <Gem className="h-3.5 w-3.5" aria-hidden />
            {BRACELET_COPY.builderModeBracelet}
          </button>
          <button
            type="button"
            onClick={() => navigate("/sunglasses")}
            className="type-label inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <Glasses className="h-3.5 w-3.5" aria-hidden />
            {BRACELET_COPY.builderModeSunglasses}
          </button>
        </div>

        {onToggleTwinning ? (
          <button
            type="button"
            onClick={onToggleTwinning}
            className={cn(
              "type-label rounded-full border px-3 py-1.5 transition-colors",
              twinning
                ? "state-selected-subtle text-foreground"
                : "border-[hsl(var(--control-border))] text-muted-foreground hover:text-foreground state-hoverable",
            )}
          >
            {twinning ? BRACELET_COPY.twinOn : BRACELET_COPY.twinOff}
          </button>
        ) : null}
      </div>
    </header>
  );
}
