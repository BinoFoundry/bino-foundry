import { useMemo, useState } from "react";
import { Copy, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FrameEntry } from "@/data/glasses";
import { cn } from "@/lib/utils";

import {
  EMPTY_FRAME_CONFIG_COPY_SELECTION,
  FRAME_CONFIG_COPY_SECTION_LABELS,
  FRAME_CONFIG_COPY_SECTION_ORDER,
  applyFrameConfigCopy,
  detectFrameConfigCopyConflicts,
  filterFramePickerItems,
  framePickerThumbnail,
  hasAnyFrameConfigCopySelection,
  selectedFrameConfigCopySections,
  type FrameConfigCopyConflictMode,
  type FrameConfigCopySection,
  type FrameConfigCopySelection,
  type FramePickerItem,
  type FramePickerSort,
} from "@/features/admin/lib/frame-config-copy";

type Step = "pick" | "sections" | "preview" | "conflict";

export type CopyFrameConfigApplyPayload = {
  renderViews: FrameEntry["renderViews"];
  lensRenderPresetId: string | null | undefined;
  useLensRenderPreset: boolean | undefined;
};

interface CopyFrameConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  frames: FramePickerItem[];
  /** Current frame being edited (excluded from picker). */
  currentFrameId?: string | null;
  destination: Pick<FrameEntry, "renderViews" | "lensRenderPresetId" | "useLensRenderPreset">;
  preferredFamily?: string | null;
  onApply: (payload: CopyFrameConfigApplyPayload) => void;
}

export function CopyFrameConfigDialog({
  open,
  onOpenChange,
  frames,
  currentFrameId,
  destination,
  preferredFamily,
  onApply,
}: CopyFrameConfigDialogProps) {
  const [step, setStep] = useState<Step>("pick");
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<string | "all" | "none">(
    preferredFamily?.trim() || "all",
  );
  const [sort, setSort] = useState<FramePickerSort>("recentlyEdited");
  const [source, setSource] = useState<FramePickerItem | null>(null);
  const [selection, setSelection] = useState<FrameConfigCopySelection>(
    EMPTY_FRAME_CONFIG_COPY_SELECTION,
  );
  const [conflictMode, setConflictMode] = useState<FrameConfigCopyConflictMode>("replace");
  const [conflicts, setConflicts] = useState<FrameConfigCopySection[]>([]);

  const familyOptions = useMemo(
    () =>
      [...new Set(frames.map((f) => f.modelFamily?.trim()).filter((v): v is string => Boolean(v)))].sort(
        (a, b) => a.localeCompare(b),
      ),
    [frames],
  );

  const filtered = useMemo(
    () =>
      filterFramePickerItems(frames, {
        query,
        family,
        excludeId: currentFrameId,
        sort,
      }),
    [frames, query, family, currentFrameId, sort],
  );

  const selectedLabels = selectedFrameConfigCopySections(selection).map(
    (section) => FRAME_CONFIG_COPY_SECTION_LABELS[section],
  );

  const reset = () => {
    setStep("pick");
    setQuery("");
    setFamily(preferredFamily?.trim() || "all");
    setSort("recentlyEdited");
    setSource(null);
    setSelection(EMPTY_FRAME_CONFIG_COPY_SELECTION);
    setConflictMode("replace");
    setConflicts([]);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    else {
      setFamily(preferredFamily?.trim() || "all");
      setStep("pick");
    }
    onOpenChange(next);
  };

  const toggleSection = (section: FrameConfigCopySection) => {
    setSelection((prev) => {
      const next = { ...prev, [section]: !prev[section] };
      if (section === "everything" && next.everything) {
        return {
          crop: true,
          lensPolygon: true,
          glassSheet: true,
          manualDetails: true,
          lensRendering: true,
          glassMaterial: true,
          allRendering: true,
          everything: true,
        };
      }
      if (section === "allRendering" && next.allRendering) {
        return {
          ...next,
          glassSheet: true,
          lensRendering: true,
          glassMaterial: true,
          everything: false,
        };
      }
      if (section !== "everything" && next.everything) {
        next.everything = false;
      }
      return next;
    });
  };

  const goPreview = () => {
    if (!source || !hasAnyFrameConfigCopySelection(selection)) return;
    setStep("preview");
  };

  const attemptApply = (mode: FrameConfigCopyConflictMode) => {
    if (!source) return;
    const result = applyFrameConfigCopy({
      source,
      destination,
      selection,
      conflictMode: mode,
    });
    onApply(result);
    handleOpenChange(false);
  };

  const confirmPreview = () => {
    if (!source) return;
    const found = detectFrameConfigCopyConflicts(destination, selection);
    if (found.length > 0) {
      setConflicts(found);
      setConflictMode("replace");
      setStep("conflict");
      return;
    }
    attemptApply("replace");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] max-w-2xl overflow-hidden p-0 sm:rounded-lg">
        <div className="space-y-4 p-6 pb-4">
          <DialogHeader>
            <DialogTitle>Copy configuration from existing frame</DialogTitle>
            <DialogDescription>
              Reuse completed crop, lens polygons, details, and rendering from another frame. Lens
              paths are copied exactly — then nudge points for this plate.
            </DialogDescription>
          </DialogHeader>

          {step === "pick" ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <div className="relative min-w-[12rem] flex-1">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    className="w-full rounded border border-border bg-background py-2 pl-8 pr-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Search frames…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <select
                  className="rounded border border-border bg-background px-2 py-2 text-sm"
                  value={family}
                  onChange={(e) => setFamily(e.target.value)}
                >
                  <option value="all">All families</option>
                  <option value="none">No family</option>
                  {familyOptions.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded border border-border bg-background px-2 py-2 text-sm"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as FramePickerSort)}
                >
                  <option value="recentlyEdited">Recently edited</option>
                  <option value="recentlyCreated">Recently created</option>
                  <option value="name">Name</option>
                </select>
              </div>

              <ul className="max-h-[min(50vh,360px)] space-y-1 overflow-y-auto rounded-md border border-border/70 p-1">
                {filtered.length === 0 ? (
                  <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                    No frames match this search.
                  </li>
                ) : (
                  filtered.map((frame) => {
                    const thumb = framePickerThumbnail(frame);
                    const active = source?.id === frame.id;
                    return (
                      <li key={frame.id}>
                        <button
                          type="button"
                          onClick={() => setSource(frame)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors",
                            active ? "bg-foreground text-background" : "hover:bg-muted/60",
                          )}
                        >
                          <span
                            className={cn(
                              "h-12 w-16 shrink-0 overflow-hidden rounded border bg-muted/30",
                              active ? "border-background/30" : "border-border/60",
                            )}
                          >
                            {thumb ? (
                              <img
                                src={thumb}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{frame.name}</span>
                            <span
                              className={cn(
                                "block truncate text-[11px]",
                                active ? "text-background/80" : "text-muted-foreground",
                              )}
                            >
                              {frame.modelFamily?.trim() || "No family"}
                              {frame.displayOrder != null
                                ? ` · order ${frame.displayOrder}`
                                : ""}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          ) : null}

          {step === "sections" && source ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Source: <span className="font-medium text-foreground">{source.name}</span>
                {source.modelFamily ? ` · ${source.modelFamily}` : ""}
              </p>
              <fieldset className="space-y-2">
                <legend className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Select what to copy
                </legend>
                {FRAME_CONFIG_COPY_SECTION_ORDER.map((section) => (
                  <label
                    key={section}
                    className="flex cursor-pointer items-start gap-2 rounded-md border border-border/60 px-3 py-2 text-sm hover:bg-muted/40"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-foreground"
                      checked={selection[section]}
                      onChange={() => toggleSection(section)}
                    />
                    <span>
                      <span className="font-medium text-foreground">
                        {FRAME_CONFIG_COPY_SECTION_LABELS[section]}
                      </span>
                      {section === "everything" ? (
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          All geometry and rendering — keeps this frame&apos;s uploaded images and
                          product metadata.
                        </span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </fieldset>
            </div>
          ) : null}

          {step === "preview" && source ? (
            <div className="space-y-3 rounded-md border border-border/70 bg-muted/10 p-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Source
                </p>
                <p className="text-sm font-medium text-foreground">{source.name}</p>
                {source.modelFamily ? (
                  <p className="text-xs text-muted-foreground">{source.modelFamily}</p>
                ) : null}
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Copying
                </p>
                <ul className="mt-1 space-y-1">
                  {selectedLabels.map((label) => (
                    <li key={label} className="text-sm text-foreground">
                      ✓ {label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {step === "conflict" ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Replace existing configuration?</p>
              <p className="text-xs text-muted-foreground">
                This frame already has data in:{" "}
                {conflicts.map((c) => FRAME_CONFIG_COPY_SECTION_LABELS[c]).join(", ")}.
              </p>
              <div className="space-y-2">
                <label className="flex items-start gap-2 rounded-md border border-border/60 px-3 py-2 text-sm">
                  <input
                    type="radio"
                    name="conflict-mode"
                    className="mt-1 accent-foreground"
                    checked={conflictMode === "replace"}
                    onChange={() => setConflictMode("replace")}
                  />
                  <span>
                    <span className="font-medium">Replace</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      Overwrite the selected sections with the source configuration.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 rounded-md border border-border/60 px-3 py-2 text-sm">
                  <input
                    type="radio"
                    name="conflict-mode"
                    className="mt-1 accent-foreground"
                    checked={conflictMode === "merge"}
                    onChange={() => setConflictMode("merge")}
                  />
                  <span>
                    <span className="font-medium">Merge</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      Append Manual Details and combine rendering keys where applicable. Crop and
                      lens polygons still replace when selected.
                    </span>
                  </span>
                </label>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t border-border/60 bg-muted/10 px-6 py-3">
          {step === "pick" ? (
            <>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!source}
                onClick={() => setStep("sections")}
              >
                Continue
              </Button>
            </>
          ) : null}
          {step === "sections" ? (
            <>
              <Button type="button" variant="outline" onClick={() => setStep("pick")}>
                Back
              </Button>
              <Button
                type="button"
                disabled={!hasAnyFrameConfigCopySelection(selection)}
                onClick={goPreview}
              >
                Review
              </Button>
            </>
          ) : null}
          {step === "preview" ? (
            <>
              <Button type="button" variant="outline" onClick={() => setStep("sections")}>
                Back
              </Button>
              <Button type="button" onClick={confirmPreview}>
                Apply
              </Button>
            </>
          ) : null}
          {step === "conflict" ? (
            <>
              <Button type="button" variant="outline" onClick={() => setStep("preview")}>
                Cancel
              </Button>
              <Button type="button" onClick={() => attemptApply(conflictMode)}>
                {conflictMode === "merge" ? "Merge" : "Replace"}
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Outline trigger button used above render views. */
export function CopyFrameConfigTrigger({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" size="sm" variant="outline" onClick={onClick}>
      <Copy className="mr-1.5 h-3.5 w-3.5" />
      Copy configuration from existing frame
    </Button>
  );
}
