import type { BuilderOptionEntry } from "@/types/sunglasses-catalog";

const POLARIZED_CODE = "polarized";

/** Options handled on the Lens step — excluded from RX / Extras. */
export function isLensStepOption(code: string): boolean {
  return code === POLARIZED_CODE;
}

/** Prescription and other options that require manual follow-up (RX step). */
export function isRxOption(option: BuilderOptionEntry): boolean {
  return option.requiresManualFollowUp || option.code === "prescription";
}

export function rxBuilderOptions(options: BuilderOptionEntry[]): BuilderOptionEntry[] {
  return options.filter((o) => !isLensStepOption(o.code) && isRxOption(o));
}

export function extrasBuilderOptions(options: BuilderOptionEntry[]): BuilderOptionEntry[] {
  return options.filter((o) => !isLensStepOption(o.code) && !isRxOption(o));
}
