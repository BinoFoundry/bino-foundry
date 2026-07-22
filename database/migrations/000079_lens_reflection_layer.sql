-- Add independent, hierarchy-driven lens reflection geometry controls.
-- Existing reflection values win; defaults are supplied only when a key is absent.

BEGIN;

UPDATE public.config_kv
SET value =
  jsonb_build_object(
    'reflectionEnabled', true,
    'reflectionOpacity', 0.2,
    'reflectionStrength', 0.42,
    'reflectionBlur', 0.58,
    'reflectionPosition', -10,
    'reflectionScale', 1.1,
    'reflectionAngle', 22
  ) || value
WHERE key = 'sunglasses.lens_render_defaults_v1';

UPDATE public.lens_rendering_presets
SET settings =
  jsonb_build_object(
    'reflectionEnabled', true,
    'reflectionPosition', -10,
    'reflectionScale', 1.1
  ) || settings,
  updated_at = now()
WHERE code IN ('clear', 'light-tint', 'classic-tint', 'dark-tint');

COMMENT ON COLUMN public.lens_rendering_presets.settings IS
  'Hierarchical lens rendering JSON. Reflection is an independent optional layer with enabled, opacity, strength, blur, position, scale, and angle controls.';

COMMIT;
