export type CustomiserStep = "frame" | "lens" | "options" | "preview";

export const CUSTOMISER_STEPS: { id: CustomiserStep; label: string; shortLabel: string }[] = [
  { id: "frame", label: "Frame", shortLabel: "Frame" },
  { id: "lens", label: "Lens", shortLabel: "Lens" },
  { id: "options", label: "Options", shortLabel: "Options" },
  { id: "preview", label: "Final Preview", shortLabel: "Preview" },
];
