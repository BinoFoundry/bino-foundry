import type { SiteGeneralSettings } from "@bino-foundry/shared/types";

import { setBeadRenderCalibrationFactor } from "./canonical-strand-mm-scale";

/** Apply site settings calibration once when settings are loaded. */
export function syncBeadRenderCalibrationFromSettings(
  settings: Pick<SiteGeneralSettings, "beadRenderCalibrationFactor">,
): void {
  setBeadRenderCalibrationFactor(settings.beadRenderCalibrationFactor);
}
