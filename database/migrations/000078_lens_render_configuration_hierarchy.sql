-- Database-backed lens material hierarchy and automatic optical response.
-- Resolution order: frame override -> lens preset -> system default.
-- The SVG rendering pipeline is unchanged.

BEGIN;

INSERT INTO public.config_kv (key, value, description)
VALUES (
  'sunglasses.lens_render_defaults_v1',
  jsonb_build_object(
    'automaticMaterialBehavior', true,
    'materialInfluence', 35,
    'baseBrightness', 0,
    'baseGamma', 1,
    'glassAbsorption', 30,
    'glassDiffusion', 18,
    'glassDepth', 50,
    'tintLayerOpacity', 0.42978,
    'lensOpacity', 0.9,
    'reflectionOpacity', 0.2,
    'edgeDarkness', 0.24,
    'backgroundVisibility', 0,
    'environmentTransparency', 0,
    'centerDensity', 0,
    'edgeDensity', 0.18,
    'tintOpacity', 0.78,
    'lensTransmission', 0.42,
    'frameExclusionOpacity', 1,
    'brightness', 1.02,
    'contrast', 1.04,
    'saturation', 0.98,
    'gradientEnabled', true,
    'gradientTopColor', NULL,
    'gradientBottomColor', NULL,
    'gradientPosition', 45,
    'gradientStrength', 0.24,
    'reflectionEnabled', true,
    'reflectionStrength', 0.42,
    'reflectionAngle', 22,
    'reflectionBlur', 0.58,
    'glossEnabled', true,
    'glossStrength', 0.14,
    'vignetteEnabled', true,
    'edgeFade', 0.12,
    'edgeWidth', 0.006,
    'polarizedEnabled', false,
    'polarizedStrength', 0.12
  ),
  'Platform-wide lens material rendering defaults (admin-editable)'
)
ON CONFLICT (key) DO NOTHING;

-- The catalog is intentionally limited to four editable built-in presets.
UPDATE public.lens_rendering_presets
SET is_default = FALSE
WHERE is_default = TRUE;

UPDATE public.lens_rendering_presets
SET is_active = TRUE,
    is_system = TRUE,
    is_default = (code = 'classic-tint'),
    settings = jsonb_set(
      settings,
      '{automaticMaterialBehavior}',
      'true'::jsonb,
      true
    ),
    updated_at = now()
WHERE code IN ('clear', 'light-tint', 'classic-tint', 'dark-tint');

UPDATE public.frames f
SET lens_render_preset_id = classic.id
FROM public.lens_rendering_presets classic
WHERE classic.code = 'classic-tint'
  AND (
    f.lens_render_preset_id IS NULL
    OR f.lens_render_preset_id NOT IN (
      SELECT id
      FROM public.lens_rendering_presets
      WHERE code IN ('clear', 'light-tint', 'classic-tint', 'dark-tint')
    )
  );

DELETE FROM public.lens_rendering_presets
WHERE code NOT IN ('clear', 'light-tint', 'classic-tint', 'dark-tint');

COMMENT ON TABLE public.lens_rendering_presets IS
  'Exactly four editable lens material presets: Clear, Light Tint, Classic Tint, and Dark Tint. Classic Tint is the default.';
COMMENT ON COLUMN public.frame_render_views.clip_config IS
  'Lens geometry plus sparse frame material overrides. Effective values resolve frame override -> assigned preset -> sunglasses.lens_render_defaults_v1.';

COMMIT;
