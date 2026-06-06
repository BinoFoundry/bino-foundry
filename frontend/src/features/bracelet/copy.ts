/** Customer-facing copy for the bracelet builder. */

export const BRACELET_COPY = {
  wristOnboardingTitle: "Create Your Bracelet",
  wristStepTitle: "Choose Your Wrist Size",
  dropReplaceHint: "Release to replace this bead",
  dropInsertHint: "Release to add here",
  dropReorderHint: "Release to place here",
  wristStepSubtitle:
    "Select your wrist measurement. Your bracelet is crafted to fit — the studio adapts to your size.",
  wristStepSelectPrompt: "Please select your bracelet size to begin.",
  wristStepContinue: "Start Designing",
  wristSizesUnavailable: "Sizing options are being prepared. Please check back shortly.",
  wristChangeHint: "Tap a size to update your bracelet target",

  wristLabel: "Bracelet target",
  wristTwinA: "First bracelet",
  wristTwinB: "Second bracelet",
  library: "Collection",
  libraryTitle: "Bead collection",
  twinOn: "Matching pair",
  twinOff: "Add matching pair",
  reset: "Start over",
  clearStrand: "Clear bracelet",
  saveConfig: "Save design",
  saving: "Saving…",

  summaryTitle: "Your design",
  summaryEmpty:
    "Open the collection and place crystals, charms, and spacers onto your strand.",
  summaryCapacity: "Strand capacity",
  summaryTarget: "Target",
  summaryUsed: "Used",
  summaryOccupied: "Occupied",
  summaryRemaining: "Remaining",
  summaryCapacityPct: "Capacity",
  summaryFilledPct: (pct: number) => `${pct}% filled`,
  summaryOverCapacity: "Capacity exceeded",
  summaryOverBy: (overCm: string) => `+${overCm}`,
  summaryOverCapacityHint: (overCm: string) => `Remove ${overCm} of beads or choose a larger wrist size`,
  capacityFull: "This strand is full — remove a piece or choose a larger wrist size to add more.",
  capacityBlocked: (sizeMm: number) =>
    `Not enough room for a ${sizeMm} mm piece (${(sizeMm / 10).toFixed(1)} cm needed). Try a smaller size or remove beads.`,
  overCapacityBanner:
    "This strand exceeds your wrist target. Remove pieces or select a larger wrist size before saving.",
  visualExpandedHint:
    "Display expanded slightly to fit your beads — your wrist target and capacity are unchanged.",
  visualOverCanvasHint:
    "This layout needs more room on screen. Remove pieces, choose a larger wrist size, or zoom out.",
  wristChangeOverCapacity:
    "Your current design exceeds the new wrist size. Remove pieces or pick a larger measurement.",
  dismissCapacityAlert: "Dismiss",

  summaryLength: "On strand",
  summaryBeadCount: "Pieces",
  summaryRemainingMm: (mm: number) => `${mm} mm still available`,
  estimatedTotal: "Estimated total",
  priceNote: (currency: string) => `Prices in ${currency} · Confirmed at checkout`,
  saveBlockedOverCapacity: "Adjust capacity before saving",

  strandGuideTitle: "Your strand",
  strandEmptyGuide: "Drag pieces from the collection into any gap on the cord",
  strandLength: (mm: number) => `${Math.round(mm)} mm placed`,
  strandHint: "Drag from the collection · drop between any two beads",
  dragToReorder: "Drag to reorder",
  removeBead: "Remove",
  emptySlotHint: "Add a piece here",
  duplicateToPair: "Match first bracelet",
  duplicateToPairHint: "Copy the first design onto the second strand",
  strandWrist: (cm: number) => `${cm} cm target`,
  piecesOnStrand: "pieces",
  strandComplete: (n: number) => `${n} pieces · at capacity`,

  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  zoomReset: "Reset view",
  zoomWheel: "Scroll to zoom",
  panModeOn: "Pan — drag to move",
  panModeOff: "Exit pan",
  panRequiresZoom: "Zoom in to pan",

  selectedBeadHint: "Tap a gap on the strand to place this piece",
  clearSelection: "Clear",
  libraryEmpty: (typeName: string) => `No ${typeName.toLowerCase()} in the collection yet.`,
  librarySearchEmpty: "No matches — try another search.",
  libraryDragHint: "Click to add quickly, or drag onto the strand for precise placement",
  fromPrice: (price: string) => `From ${price}`,
} as const;
