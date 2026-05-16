export type LensTintCategory = "classic" | "gradient";

export interface LensTintEntry {
  id: string;
  code: string;
  name: string;
  category: LensTintCategory;
  gradientTop: string;
  gradientBottom: string;
  priceSurcharge: number;
  displayOrder: number;
  isActive: boolean;
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

export interface FrameColorEntry {
  id: string;
  name: string;
  hex: string;
  displayOrder: number;
  isActive: boolean;
}

export interface SunglassesCatalogSnapshot {
  lensTints: LensTintEntry[];
  builderOptions: BuilderOptionEntry[];
  frameColors: FrameColorEntry[];
  lensDisclaimer: string;
}
