/** Customer-facing strings for toasts and alerts (non-technical). */

export const CUSTOMER_COPY = {
  catalogueLoadFailed: "We couldn't load the catalogue. Please try again.",
  sunglassesLoadFailed: "We couldn't load sunglasses options. Please try again.",
  adminSettingsLoadFailed: "We couldn't load settings. Please try again.",
  braceletLayoutUpdated: "Bracelet layout updated",
  beadsRemoved:
    (n: number) =>
      `${n} ${n === 1 ? "bead was" : "beads were"} removed to fit your new bracelet size.`,
  saveDesignNeedBeads: "Add at least one bead before saving your design.",
  saveDesignSuccess: (ref: string) => `Design saved · reference ${ref}`,
  saveDesignFailed: "We couldn't save your design. Please try again.",
  quoteCopiedPrescription:
    "Your configuration was copied. Our team will contact you about prescription details.",
  quoteCopiedReady:
    "Your configuration was copied. Share it with us to request a quote.",
  quoteCopyFallbackTitle: "Your configuration",
} as const;
