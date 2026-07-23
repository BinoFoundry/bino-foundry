-- Promote density gradient to independent start/end falloff + curve.
-- Existing strength values are copied into both falloffs when falloffs are missing.

BEGIN;

UPDATE public.config_kv
SET value = value || jsonb_build_object(
  'densityGradientStartFalloff', COALESCE(
    value->'densityGradientStartFalloff',
    value->'densityGradientStrength',
    '50'::jsonb
  ),
  'densityGradientEndFalloff', COALESCE(
    value->'densityGradientEndFalloff',
    value->'densityGradientStrength',
    '50'::jsonb
  ),
  'densityGradientCurve', COALESCE(value->'densityGradientCurve', '"linear"'::jsonb),
  'densityGradientTwoColor', COALESCE(value->'densityGradientTwoColor', 'true'::jsonb)
)
WHERE key = 'sunglasses.lens_render_defaults_v1';

UPDATE public.lens_rendering_presets
SET settings = settings || jsonb_build_object(
  'densityGradientStartFalloff', COALESCE(
    settings->'densityGradientStartFalloff',
    settings->'densityGradientStrength',
    '50'::jsonb
  ),
  'densityGradientEndFalloff', COALESCE(
    settings->'densityGradientEndFalloff',
    settings->'densityGradientStrength',
    '50'::jsonb
  ),
  'densityGradientCurve', COALESCE(settings->'densityGradientCurve', '"linear"'::jsonb),
  'densityGradientTwoColor', COALESCE(settings->'densityGradientTwoColor', 'true'::jsonb)
);

COMMIT;
