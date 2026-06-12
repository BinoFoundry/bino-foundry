export type CustomiserStep = "frame" | "lens" | "rx" | "extras" | "preview";

export const CUSTOMISER_STEPS: { id: CustomiserStep; label: string; shortLabel: string }[] = [
  { id: "frame", label: "Frame", shortLabel: "Frame" },
  { id: "lens", label: "Lens", shortLabel: "Lens" },
  { id: "rx", label: "RX", shortLabel: "RX" },
  { id: "extras", label: "Add-Ons", shortLabel: "Add-Ons" },
  { id: "preview", label: "Review", shortLabel: "Review" },
];

/** One-to-one with {@link CUSTOMISER_STEPS} for the horizontal stepper. */
export const SUNGLASSES_NAV_STEPS: {
  id: CustomiserStep;
  flowStep: CustomiserStep;
  label: string;
}[] = CUSTOMISER_STEPS.map((step) => ({
  id: step.id,
  flowStep: step.id,
  label: step.label,
}));
