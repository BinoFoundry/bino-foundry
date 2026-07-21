import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Active inline editor — blush fill + olive accent per admin design system. */
export const INLINE_EDITOR_ACTIVE_CLASS =
  "rounded-lg border-2 border-[hsl(var(--brand-olive))]/45 bg-[#D9BBB0]/30 p-3";

export const INLINE_SECTION_ACTIVE_CLASS =
  "rounded-lg border border-[hsl(var(--brand-olive))]/35 bg-[#D9BBB0]/15 p-3";

interface InlineEditorPanelProps {
  title: string;
  description?: string;
  /** Contextual tools (auto-detect, reset) — only visible while this editor is open. */
  toolbar?: ReactNode;
  /** Transient confirmation rendered beside the save action. */
  saveFeedback?: ReactNode;
  onSave: () => void;
  onCancel: () => void;
  saveDisabled?: boolean;
  saveLabel?: string;
  children: ReactNode;
  className?: string;
}

/** Expandable editor shell with optional toolbar and Save / Cancel footer. */
export function InlineEditorPanel({
  title,
  description,
  toolbar,
  saveFeedback,
  onSave,
  onCancel,
  saveDisabled = false,
  saveLabel = "Save changes",
  children,
  className,
}: InlineEditorPanelProps) {
  return (
    <div className={cn(INLINE_EDITOR_ACTIVE_CLASS, "mt-3 space-y-3", className)}>
      <div>
        <h5 className="text-sm font-semibold text-foreground">{title}</h5>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>

      {toolbar ? <div className="flex flex-wrap gap-2">{toolbar}</div> : null}

      {children}

      <div className="flex flex-wrap gap-2 border-t border-[hsl(var(--brand-olive))]/20 pt-3">
        <Button type="button" size="sm" disabled={saveDisabled} onClick={onSave}>
          {saveLabel}
        </Button>
        {saveFeedback ? (
          <div className="flex items-center text-xs text-status-success" role="status" aria-live="polite">
            {saveFeedback}
          </div>
        ) : null}
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
