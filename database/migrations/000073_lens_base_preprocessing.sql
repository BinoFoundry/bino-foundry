-- Add identity-safe original-lens preprocessing controls to every rendering preset.
-- The settings column is JSONB, so no table shape change is required.
--
-- Missing and explicit zero values are equivalent at runtime:
--   baseExposure       -100..100 (0 = unchanged)
--   baseContrast       -100..100 (0 = unchanged)
--   baseNeutralization    0..100 (0 = original colour)

UPDATE lens_rendering_presets
SET settings =
  jsonb_build_object(
    'baseExposure', 0,
    'baseContrast', 0,
    'baseNeutralization', 0
  ) || settings
WHERE NOT (
  settings ? 'baseExposure'
  AND settings ? 'baseContrast'
  AND settings ? 'baseNeutralization'
);

COMMENT ON COLUMN lens_rendering_presets.settings IS
  'Lens material JSON including pre-tint baseExposure (-100..100), baseContrast (-100..100), and baseNeutralization (0..100).';
