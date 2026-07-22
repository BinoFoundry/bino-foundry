-- Make source-lens chroma retention explicit while preserving the existing luminance pipeline.
-- 0 = neutral luminance only; 100 = full source hue/saturation before selected tint.

BEGIN;

UPDATE public.config_kv
SET value =
  jsonb_build_object('originalLensColorInfluence', 15) || value
WHERE key = 'sunglasses.lens_render_defaults_v1';

UPDATE public.lens_rendering_presets
SET settings =
  jsonb_build_object('originalLensColorInfluence', 15) || settings,
  updated_at = now()
WHERE code IN ('clear', 'light-tint', 'classic-tint', 'dark-tint');

COMMENT ON COLUMN public.lens_rendering_presets.settings IS
  'Hierarchical lens rendering JSON. originalLensColorInfluence controls source chroma retention before tinting; 0 preserves luminance only.';

COMMIT;
