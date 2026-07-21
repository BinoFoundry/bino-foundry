-- Align lens rendering presets with the control-system catalog (layered renderer unchanged).
-- Does NOT modify prior migrations or change the SVG compositing pipeline.
-- Presets only store opacity/density parameters the existing renderer already reads.

BEGIN;

-- Clear default flag so we can reassign Classic as the global default.
UPDATE public.lens_rendering_presets SET is_default = FALSE WHERE is_default = TRUE;

INSERT INTO public.lens_rendering_presets (code, name, description, display_order, is_default, settings)
VALUES
  (
    'very-light',
    'Very Light',
    'Minimal tint density; original lens texture dominates.',
    10,
    FALSE,
    jsonb_build_object(
      'tintLayerOpacity', 0.18,
      'lensOpacity', 0.55,
      'reflectionOpacity', 0.14,
      'edgeDarkness', 0.1,
      'backgroundVisibility', 0.28,
      'environmentTransparency', 0.35,
      'centerDensity', 0,
      'edgeDensity', 0.06
    )
  ),
  (
    'light',
    'Light',
    'Light everyday tint with clear glass depth.',
    20,
    FALSE,
    jsonb_build_object(
      'tintLayerOpacity', 0.28,
      'lensOpacity', 0.72,
      'reflectionOpacity', 0.18,
      'edgeDarkness', 0.16,
      'backgroundVisibility', 0.14,
      'environmentTransparency', 0.18,
      'centerDensity', 0,
      'edgeDensity', 0.1
    )
  ),
  (
    'classic',
    'Classic',
    'Balanced classic sunglass optics (global default).',
    30,
    TRUE,
    jsonb_build_object(
      'tintLayerOpacity', 0.42978,
      'lensOpacity', 0.9,
      'reflectionOpacity', 0.2,
      'edgeDarkness', 0.24,
      'backgroundVisibility', 0,
      'environmentTransparency', 0,
      'centerDensity', 0,
      'edgeDensity', 0.18
    )
  ),
  (
    'dark',
    'Dark',
    'Strong everyday dark tint.',
    40,
    FALSE,
    jsonb_build_object(
      'tintLayerOpacity', 0.58,
      'lensOpacity', 0.94,
      'reflectionOpacity', 0.18,
      'edgeDarkness', 0.3,
      'backgroundVisibility', 0,
      'environmentTransparency', 0,
      'centerDensity', 0.08,
      'edgeDensity', 0.24
    )
  ),
  (
    'very-dark',
    'Very Dark',
    'Maximum density for deep sunglass lenses.',
    50,
    FALSE,
    jsonb_build_object(
      'tintLayerOpacity', 0.72,
      'lensOpacity', 0.98,
      'reflectionOpacity', 0.16,
      'edgeDarkness', 0.36,
      'backgroundVisibility', 0,
      'environmentTransparency', 0,
      'centerDensity', 0.16,
      'edgeDensity', 0.32
    )
  ),
  (
    'mirror',
    'Mirror',
    'Higher reflection sheen with moderate tint.',
    60,
    FALSE,
    jsonb_build_object(
      'tintLayerOpacity', 0.4,
      'lensOpacity', 0.88,
      'reflectionOpacity', 0.34,
      'edgeDarkness', 0.22,
      'backgroundVisibility', 0.04,
      'environmentTransparency', 0.06,
      'centerDensity', 0.04,
      'edgeDensity', 0.16
    )
  ),
  (
    'gradient',
    'Gradient',
    'Emphasises vertical density gradient and edge falloff.',
    70,
    FALSE,
    jsonb_build_object(
      'tintLayerOpacity', 0.4,
      'lensOpacity', 0.86,
      'reflectionOpacity', 0.2,
      'edgeDarkness', 0.2,
      'backgroundVisibility', 0.06,
      'environmentTransparency', 0.08,
      'centerDensity', 0.05,
      'edgeDensity', 0.22,
      'gradientEnabled', true,
      'gradientStrength', 0.42
    )
  ),
  (
    'fashion',
    'Fashion',
    'Lighter fashion tint with more background visibility.',
    80,
    FALSE,
    jsonb_build_object(
      'tintLayerOpacity', 0.32,
      'lensOpacity', 0.78,
      'reflectionOpacity', 0.22,
      'edgeDarkness', 0.18,
      'backgroundVisibility', 0.12,
      'environmentTransparency', 0.08,
      'centerDensity', 0,
      'edgeDensity', 0.12
    )
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_default = EXCLUDED.is_default,
  settings = EXCLUDED.settings,
  updated_at = now();

-- Point frames still on legacy seed codes to Classic when they inherit the old default.
UPDATE public.frames f
SET lens_render_preset_id = classic.id
FROM public.lens_rendering_presets classic
JOIN public.lens_rendering_presets legacy ON legacy.code IN ('medium-tint', 'dark-sunglasses', 'fashion-tint', 'clear-lens')
WHERE classic.code = 'classic'
  AND f.lens_render_preset_id = legacy.id
  AND f.use_lens_render_preset = TRUE;

-- Any frame with no preset yet inherits Classic.
UPDATE public.frames f
SET lens_render_preset_id = p.id
FROM public.lens_rendering_presets p
WHERE p.code = 'classic'
  AND f.lens_render_preset_id IS NULL;

COMMENT ON TABLE public.lens_rendering_presets IS
  'Named lens optical parameter presets. Renderer pipeline is unchanged (original lens → tint → reflection → edge). Presets only supply opacity/density values.';

COMMIT;
