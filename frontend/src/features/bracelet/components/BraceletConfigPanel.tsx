import BeadLibrary, { type LibraryDragPayload } from "@/components/BeadLibrary";
import type { BeadLibraryEntry } from "@/types/beads";
import type { BeadLibrarySizeOffer } from "@/types/bead-library-sizes";
import type { WristSizeEntry } from "@/types/wrist-sizes";

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
}

/** Left sidebar — bead library only on desktop; wrist size lives in the summary panel. */
export function BraceletConfigPanel({
  onSelectBead,
  onLibraryDragActiveChange,
  onLibraryDragChange,
  libraryOpen = true,
  onCloseLibrary,
  embedded = true,
}: BraceletConfigPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
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
