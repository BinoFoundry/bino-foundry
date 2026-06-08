import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { BuilderOptionEntry, LensTintEntry } from "@/types/sunglasses-catalog";
import type { FrameOption } from "@/lib/luxe-data";

interface PreviewStepPanelProps {
  frameSku: FrameOption;
  tintName: string;
  selectedTintEntry: LensTintEntry | null;
  polarized: boolean;
  polarizedLabel?: string;
  polarizedSurcharge?: number;
  builderOptions: BuilderOptionEntry[];
  selectedOptions: Record<string, boolean>;
  requiresManualFollowUp: boolean;
  basePrice: number;
  totalPrice: number;
  lensDisclaimer: string;
  onRequestQuote?: () => void;
}

export function PreviewStepPanel({
  requiresManualFollowUp,
  lensDisclaimer,
}: PreviewStepPanelProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="type-h3">Review</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Confirm your selections below. Your live preview updates as you configure each step.
        </p>
      </div>

      {requiresManualFollowUp ? (
        <Alert>
          <AlertTitle>Prescription lenses</AlertTitle>
          <AlertDescription className="text-sm">
            You selected options that need a prescription. Our team will contact you to confirm lens power and fit
            before any order is placed.
          </AlertDescription>
        </Alert>
      ) : (
        <p className="text-sm text-foreground">
          Your configuration is complete. Use Add to Cart or Save Design when you are ready.
        </p>
      )}

      {lensDisclaimer ? (
        <p className="text-[10px] leading-relaxed text-muted-foreground">* {lensDisclaimer}</p>
      ) : null}
    </div>
  );
}
