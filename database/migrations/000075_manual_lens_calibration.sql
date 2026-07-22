-- Deterministic, administrator-controlled lens calibration.
-- No image analysis or automatic colour matching is performed.

UPDATE public.lens_rendering_presets
SET settings =
  jsonb_build_object(
    'baseBrightness', 0,
    'baseSaturation', 100,
    'baseGamma', 1,
    'glassAbsorption', 30,
    'glassDiffusion', 18,
    'glassDepth', 50
  ) || settings
WHERE NOT (
  settings ? 'baseBrightness'
  AND settings ? 'baseSaturation'
  AND settings ? 'baseGamma'
  AND settings ? 'glassAbsorption'
  AND settings ? 'glassDiffusion'
  AND settings ? 'glassDepth'
);

COMMENT ON COLUMN public.lens_rendering_presets.settings IS
  'Deterministic lens material JSON. Manual controls include baseBrightness (-100..100), baseSaturation (0..100), baseGamma (0.5..2.5), glassMaterialStrength, glassAbsorption, glassDiffusion, and glassDepth (all 0..100).';
