export const catalogueKeys = {
  all: ["catalogue"] as const,
  beadLibraries: () => [...catalogueKeys.all, "bead-libraries"] as const,
  beadTypes: () => [...catalogueKeys.all, "bead-types"] as const,
  frames: () => [...catalogueKeys.all, "frames"] as const,
};
