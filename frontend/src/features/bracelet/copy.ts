/** Customer-facing copy for the bracelet builder (avoid internal/dev terms). */

export const BRACELET_COPY = {
  wristLabel: "Wrist size",
  wristTwinA: "First bracelet",
  wristTwinB: "Second bracelet",
  beadSizeLabel: "Bead size",
  library: "Bead collection",
  twinOn: "Matching pair",
  twinOff: "Add matching pair",
  reset: "Start over",
  saveConfig: "Save design",
  saving: "Saving…",

  summaryTitle: "Your bracelet",
  summaryEmpty:
    "Choose beads from the collection. Each circle on the ring shows where a bead will sit on your finished piece.",
  summaryRemaining: (n: number) =>
    `${n} open ${n === 1 ? "space" : "spaces"} left on the strand`,
  estimatedTotal: "Estimated total",
  priceNote: (currency: string) => `All prices in ${currency} · Final total confirmed at checkout`,

  strandGuideTitle: "Your bracelet layout",
  strandSlots: (n: number, mm: number) => `${n} bead spaces · ${mm} mm size`,
  strandHint:
    "Open the bead collection, then tap a space or drag a bead onto the cord. Use × on a bead to remove it.",
  removeBead: "Remove bead",
  duplicateToPair: "Match first bracelet",
  duplicateToPairHint: "Copy the first bracelet design onto the second",
  strandProgress: (placed: number, total: number) => `${placed} of ${total} beads placed`,
  strandWrist: (cm: number) => `${cm} cm wrist`,

  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  zoomReset: "Reset zoom and position",
  zoomWheel: "Scroll over the canvas to zoom in or out",
  panModeOn: "Pan mode — drag to move the view",
  panModeOff: "Exit pan mode",
  panRequiresZoom: "Zoom in first to pan around the bracelet",

  beadsPruned: (n: number) =>
    `${n} ${n === 1 ? "bead was" : "beads were"} removed because the strand has fewer spaces at this size.`,
  selectedBeadHint: "Tap an open circle on the strand to place this bead",
  selectedBeadLabel: "Selected bead",
  clearSelection: "Clear selection",
  libraryEmpty: (typeName: string) => `No ${typeName.toLowerCase()} in the collection yet.`,
  librarySearchEmpty: "No beads match your search.",
} as const;
