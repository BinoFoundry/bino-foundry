export const catalogueKeys = {
  all: ["catalogue"] as const,
  crystals: () => [...catalogueKeys.all, "crystals"] as const,
  frames: () => [...catalogueKeys.all, "frames"] as const,
  types: () => [...catalogueKeys.all, "types"] as const,
};
