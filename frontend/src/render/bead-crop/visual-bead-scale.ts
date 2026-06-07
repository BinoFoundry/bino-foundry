/**
 * Visually calibrated mm → px mapping for the bracelet strand.
 *
 * Wrist fit, capacity, and pricing always use true database mm values.
 * This curve only affects rendered bead footprint on the canvas.
 */

/** Calibrated anchor points (mm → px at layout scale factor 1, before STRAND_BEAD_VISUAL_SCALE). */
export const VISUAL_BEAD_SCALE_ANCHORS: ReadonlyArray<{ mm: number; px: number }> = [
  { mm: 0.1, px: 11 },
  { mm: 0.5, px: 14 },
  { mm: 1, px: 16 },
  { mm: 2.5, px: 20 },
  { mm: 4, px: 23 },
  { mm: 6, px: 25 },
  { mm: 8, px: 27 },
  { mm: 10, px: 29 },
  { mm: 12, px: 30 },
  { mm: 20, px: 32 },
] as const;

/** Sub-mm extrapolation floor (0.01 mm → 9 px). */
const EXTRAPOLATION_MIN_MM = 0.01;
const EXTRAPOLATION_MIN_PX = 9;

/** Soft ceiling for very large catalog sizes (40 mm → 35 px). */
const EXTRAPOLATION_MAX_MM = 40;
const EXTRAPOLATION_MAX_PX = 35;

/**
 * Map physical bead diameter (mm) to a balanced visual pixel diameter.
 * Uses log-space interpolation between calibrated anchors.
 */
export function calibratedVisualDiameterPx(sizeMm: number): number {
  const mm = sizeMm > 0 ? sizeMm : EXTRAPOLATION_MIN_MM;
  const first = VISUAL_BEAD_SCALE_ANCHORS[0];
  const last = VISUAL_BEAD_SCALE_ANCHORS[VISUAL_BEAD_SCALE_ANCHORS.length - 1];

  if (mm < first.mm) {
    const logMm = Math.log(mm);
    const logLo = Math.log(EXTRAPOLATION_MIN_MM);
    const logHi = Math.log(first.mm);
    const t = (logMm - logLo) / (logHi - logLo);
    return EXTRAPOLATION_MIN_PX + t * (first.px - EXTRAPOLATION_MIN_PX);
  }

  if (mm > last.mm) {
    const logMm = Math.log(mm);
    const logLo = Math.log(last.mm);
    const logHi = Math.log(EXTRAPOLATION_MAX_MM);
    const t = Math.min(1, (logMm - logLo) / (logHi - logLo));
    return last.px + t * (EXTRAPOLATION_MAX_PX - last.px);
  }

  const logMm = Math.log(mm);
  for (let i = 0; i < VISUAL_BEAD_SCALE_ANCHORS.length - 1; i++) {
    const a = VISUAL_BEAD_SCALE_ANCHORS[i];
    const b = VISUAL_BEAD_SCALE_ANCHORS[i + 1];
    if (mm < a.mm) continue;
    if (mm > b.mm) continue;
    const t = (logMm - Math.log(a.mm)) / (Math.log(b.mm) - Math.log(a.mm));
    return a.px + t * (b.px - a.px);
  }

  return last.px;
}
