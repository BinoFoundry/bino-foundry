import { DEFAULT_BEAD_RENDER_CALIBRATION_FACTOR } from "./bead-render-calibration.js";

export const SITE_SETTINGS_VERSION = 1 as const;

export interface SiteGeneralSettings {
  currencyCode: string;
  /** Left sidebar title in the bracelet builder (admin-configurable). */
  braceletBuilderLibraryTitle: string;
  /**
   * Uniform scale when converting size_mm to rendered diameter in the bracelet builder.
   * renderDiameter = calibratedCurve(mm) × layoutScale × beadRenderCalibrationFactor
   */
  beadRenderCalibrationFactor: number;
}

export const DEFAULT_SITE_GENERAL_SETTINGS: SiteGeneralSettings = {
  currencyCode: "SGD",
  braceletBuilderLibraryTitle: "Bead collection",
  beadRenderCalibrationFactor: DEFAULT_BEAD_RENDER_CALIBRATION_FACTOR,
};
