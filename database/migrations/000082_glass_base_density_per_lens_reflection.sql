-- Base glass material calibration + per-lens reflection.
-- Hierarchy remains Frame Override → Preset → System Default.
-- Manual calibration only — no automatic colour analysis.

BEGIN;

UPDATE public.config_kv
SET value =
  jsonb_build_object(
    'mirrorReflection', true,
    'reflectionRightAngle', 338,
    'reflectionRightOffsetX', 10,
    'reflectionRightOffsetY', -8,
    'reflectionRightScale', 1.1,
    'reflectionRightOpacity', 0.2,
    'reflectionRightBlur', 0.58,
    'baseGlassDarkness', 28,
    'baseGlassRichness', 55,
    'baseGlassNeutralization', 85
  ) || value
WHERE key = 'sunglasses.lens_render_defaults_v1';

UPDATE public.lens_rendering_presets
SET settings =
  jsonb_build_object(
    'mirrorReflection', true,
    'reflectionRightAngle', 338,
    'reflectionRightOffsetX', 10,
    'reflectionRightOffsetY', -8,
    'reflectionRightScale', 1.1,
    'reflectionRightOpacity', 0.2,
    'reflectionRightBlur', 0.58,
    'baseGlassDarkness', 28,
    'baseGlassRichness', 55,
    'baseGlassNeutralization', 85
  ) || settings,
  updated_at = now()
WHERE code IN ('clear', 'light-tint', 'classic-tint', 'dark-tint');

COMMIT;
