/** Guided bracelet builder journey — order is fixed. */

export type BuilderStepId = "select-beads" | "wrist-size" | "add-charms" | "review";

export interface BuilderStepDefinition {
  id: BuilderStepId;
  number: number;
  label: string;
  shortLabel: string;
}

export const BUILDER_STEPS: readonly BuilderStepDefinition[] = [
  { id: "select-beads", number: 1, label: "Select Beads", shortLabel: "Beads" },
  { id: "wrist-size", number: 2, label: "Wrist Size", shortLabel: "Wrist" },
  { id: "add-charms", number: 3, label: "Add Charms", shortLabel: "Charms" },
  { id: "review", number: 4, label: "Review", shortLabel: "Review" },
] as const;

export const CHARM_TYPE_SLUG = "charm";

export function builderStepIndex(id: BuilderStepId): number {
  return BUILDER_STEPS.findIndex((s) => s.id === id);
}
