import BeadLibrary, { type LibraryDragPayload } from "@/components/BeadLibrary";
import type { BeadLibraryEntry } from "@/types/beads";
import type { BeadLibrarySizeOffer } from "@/types/bead-library-sizes";
import type { WristSizeEntry } from "@/types/wrist-sizes";

import type { BraceletBuilderActionsProps } from "./BraceletBuilderActions";
import { BraceletNameField } from "./BraceletNameField";
import { BuilderSidebarContext } from "./BuilderSidebarContext";

export interface BraceletConfigPanelProps {
  wristSizeCm: number;
  wristSizeCmB?: number;
  twinning?: boolean;
  wristSizes: WristSizeEntry[];
  wristSizeIdA: string | null;
  wristSizeIdB?: string | null;
  onSelectWristA: (entry: WristSizeEntry) => void;
  onSelectWristB?: (entry: WristSizeEntry) => void;
  onSelectBead: (bead: BeadLibraryEntry, size?: BeadLibrarySizeOffer) => void;
  onLibraryDragActiveChange?: (active: boolean) => void;
  onLibraryDragChange?: (active: boolean, payload?: LibraryDragPayload) => void;
  libraryOpen?: boolean;
  onCloseLibrary?: () => void;
  embedded?: boolean;
  builderActions?: BraceletBuilderActionsProps;
  braceletName?: string;
  onBraceletNameChange?: (value: string) => void;
}

/** Left sidebar — bracelet context, search, categories, and bead library. */
export function BraceletConfigPanel({
  wristSizeCm,
  wristSizeCmB,
  twinning,
  wristSizes,
  wristSizeIdA,
  wristSizeIdB,
  onSelectWristA,
  onSelectWristB,
  onSelectBead,
  onLibraryDragActiveChange,
  onLibraryDragChange,
  libraryOpen = true,
  onCloseLibrary,
  embedded = true,
  builderActions,
  braceletName = "",
  onBraceletNameChange,
}: BraceletConfigPanelProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!embedded && onBraceletNameChange ? (
        <div className="shrink-0 border-b border-border/60 px-2.5 py-2.5">
          <BraceletNameField
            id="bracelet-name-mobile"
            value={braceletName}
            onChange={onBraceletNameChange}
          />
        </div>
      ) : null}

      {embedded ? (
        <div className="shrink-0 border-b border-border/60 p-1.5">
          <BuilderSidebarContext
            wristSizeCm={wristSizeCm}
            wristSizeCmB={wristSizeCmB}
            twinning={twinning}
            wristSizes={wristSizes}
            wristSizeIdA={wristSizeIdA}
            wristSizeIdB={wristSizeIdB}
            onSelectWristA={onSelectWristA}
            onSelectWristB={onSelectWristB}
            builderActions={builderActions}
          />
        </div>
      ) : null}

      <BeadLibrary
        variant={embedded ? "embedded" : "overlay"}
        open={libraryOpen}
        onClose={onCloseLibrary ?? (() => {})}
        onSelectBead={onSelectBead}
        onLibraryDragActiveChange={onLibraryDragActiveChange}
        onLibraryDragChange={onLibraryDragChange}
        compact={embedded}
      />
    </div>
  );
}
