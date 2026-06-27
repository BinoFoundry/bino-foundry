/** Per-asset factor: group_reference_diameter / asset_visible_diameter */
export function computeMmGroupNormalizationFactor(
  groupReferenceDiameterPx: number,
  assetVisibleDiameterPx: number,
): number {
  if (
    !Number.isFinite(groupReferenceDiameterPx) ||
    !Number.isFinite(assetVisibleDiameterPx) ||
    groupReferenceDiameterPx <= 0 ||
    assetVisibleDiameterPx <= 0
  ) {
    return 1;
  }
  return groupReferenceDiameterPx / assetVisibleDiameterPx;
}

/** Apply mm-group normalization to the configured mm target diameter. */
export function effectiveMmTargetDiameterPx(
  baseTargetDiameterPx: number,
  normalizationFactor: number,
): number {
  if (!Number.isFinite(baseTargetDiameterPx) || baseTargetDiameterPx <= 0) return baseTargetDiameterPx;
  if (!Number.isFinite(normalizationFactor) || normalizationFactor <= 0) return baseTargetDiameterPx;
  return baseTargetDiameterPx * normalizationFactor;
}
