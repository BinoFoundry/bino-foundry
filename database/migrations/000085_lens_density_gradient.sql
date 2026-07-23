-- Seed density-gradient material keys. Default OFF to preserve existing uniform-lens presets.

BEGIN;

UPDATE public.config_kv
SET value = value || jsonb_build_object(
  'densityGradientEnabled', COALESCE(value->'densityGradientEnabled', 'false'::jsonb),
  'densityGradientMode', COALESCE(value->'densityGradientMode', '"vertical"'::jsonb),
  'densityGradientAngle', COALESCE(value->'densityGradientAngle', '90'::jsonb),
  'densityGradientTwoColor', COALESCE(value->'densityGradientTwoColor', 'false'::jsonb),
  'densityGradientStartColor', COALESCE(value->'densityGradientStartColor', '"#1E1E1E"'::jsonb),
  'densityGradientEndColor', COALESCE(value->'densityGradientEndColor', '"#4B4B4B"'::jsonb),
  'densityGradientStrength', COALESCE(value->'densityGradientStrength', '45'::jsonb),
  'densityGradientSoftness', COALESCE(value->'densityGradientSoftness', '55'::jsonb),
  'densityGradientPosition', COALESCE(value->'densityGradientPosition', '45'::jsonb)
)
WHERE key = 'sunglasses.lens_render_defaults_v1';

UPDATE public.lens_rendering_presets
SET settings = settings || jsonb_build_object(
  'densityGradientEnabled', COALESCE(settings->'densityGradientEnabled', 'false'::jsonb),
  'densityGradientMode', COALESCE(settings->'densityGradientMode', '"vertical"'::jsonb),
  'densityGradientAngle', COALESCE(settings->'densityGradientAngle', '90'::jsonb),
  'densityGradientTwoColor', COALESCE(settings->'densityGradientTwoColor', 'false'::jsonb),
  'densityGradientStartColor', COALESCE(settings->'densityGradientStartColor', '"#1E1E1E"'::jsonb),
  'densityGradientEndColor', COALESCE(settings->'densityGradientEndColor', '"#4B4B4B"'::jsonb),
  'densityGradientStrength', COALESCE(settings->'densityGradientStrength', '45'::jsonb),
  'densityGradientSoftness', COALESCE(settings->'densityGradientSoftness', '55'::jsonb),
  'densityGradientPosition', COALESCE(settings->'densityGradientPosition', '45'::jsonb)
);

COMMIT;
