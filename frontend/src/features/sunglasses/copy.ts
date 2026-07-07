/** Customer-facing copy for the sunglasses builder. */

export const SUNGLASSES_COPY = {
  frameStepTitle: "Select Frame",
  lensStepTitle: "Lens options",
  lensStepIntro:
    "Choose standard or polarised lenses, then pick a Classic or Gradient tint from the tabs below.",
  rxStepTitle: "Prescription lenses",
  rxStepIntro:
    "Enjoy clear vision when you're out in the sun. Upgrade to prescription lenses so you can step out hassle free. Our team will be in touch to confirm your details before production.",
  degreeLimitations: "Degree Limitations",
  addOnsStepTitle: "Add-Ons",
  addOnsStepIntro: "Optional add-ons for your sunglasses.",
  reviewStepTitle: "Review",
  reviewStepIntro: "Confirm your selections below.",
  yourConfiguration: "Your Configuration",
  unavailableFrameNotice:
    "Some items used in this design are no longer available and must be replaced before ordering.",
  unavailableFrameName: "Unavailable Frame",
  unavailableFrameDeleted: "Deleted",
  unavailableFrameStatus: "Unavailable",
  unavailableFramePrompt: "Please choose another frame.",
  checkoutBlockedUnavailableFrame:
    "Replace the unavailable frame before adding this design to your cart.",
  addOnsSectionTitle: "Add-Ons",
  summaryTint: "Tint",
  summaryPolarized: "Polarised",
} as const;

/** Subtle price hierarchy — slightly larger than default labels. */
export const SUNGLASSES_PRICE = {
  item: "type-price text-sm text-primary sm:text-base",
  surcharge: "type-price text-xs text-muted-foreground sm:text-sm",
  total: "type-price text-[1.65rem] text-foreground sm:text-3xl",
} as const;

/** Display polish for catalogue option descriptions (presentation only). */
export function formatBuilderOptionDescription(description: string): string {
  return description.replace(/\breduces glare\b/gi, "Reduces Glare");
}
