import type {
  GradientDirection,
  LensClipRenderSettings,
  LensMaterialProfile,
  LensTintCategory,
  LensRenderingPreset,
} from "@bino-foundry/shared/types";

export type { GradientDirection, LensTintCategory, LensRenderingPreset };

export interface LensTintEntry {
  id: string;
  code: string;
  name: string;
  category: LensTintCategory;
  gradientTop: string;
  gradientBottom: string;
  opacity: number;
  gradientDirection: GradientDirection;
  gradientAngle: number;
  gradientMidPosition: number;
  gradientIntensity: number;
  priceSurcharge: number;
  displayOrder: number;
  isActive: boolean;
  /** Whether this tint may be chosen with polarised lenses (admin-controlled; e.g. grey). */
  polarizedAvailable: boolean;
}

export interface BuilderOptionEntry {
  id: string;
  code: string;
  label: string;
  description: string;
  priceSurcharge: number;
  requiresManualFollowUp: boolean;
  tooltipText: string | null;
  displayOrder: number;
  isActive: boolean;
}

export interface SunglassesCatalogSnapshot {
  lensTints: LensTintEntry[];
  builderOptions: BuilderOptionEntry[];
  lensRenderPresets: LensRenderingPreset[];
  lensRenderSystemDefaults: LensClipRenderSettings;
  lensMaterialProfiles: LensMaterialProfile[];
  lensDisclaimer: string;
}
