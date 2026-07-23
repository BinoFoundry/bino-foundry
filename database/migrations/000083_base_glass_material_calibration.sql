-- Promote legacy calibration keys to Base Glass Darkness / Richness / Neutralization.
-- Safe if 000082 already applied with older key names.

BEGIN;

-- System defaults
UPDATE public.config_kv
SET value =
  CASE
    WHEN value ? 'glassBaseDensity' AND NOT (value ? 'baseGlassDarkness')
      THEN (value - 'glassBaseDensity') || jsonb_build_object('baseGlassDarkness', value->'glassBaseDensity')
    ELSE value
  END
WHERE key = 'sunglasses.lens_render_defaults_v1';

UPDATE public.config_kv
SET value =
  CASE
    WHEN value ? 'baseDensityBias' AND NOT (value ? 'baseGlassRichness')
      THEN (value - 'baseDensityBias') || jsonb_build_object('baseGlassRichness', value->'baseDensityBias')
    ELSE value
  END
WHERE key = 'sunglasses.lens_render_defaults_v1';

UPDATE public.config_kv
SET value =
  CASE
    WHEN value ? 'originalLensColorInfluence' AND NOT (value ? 'baseGlassNeutralization')
      THEN value || jsonb_build_object(
        'baseGlassNeutralization',
        to_jsonb(GREATEST(0, LEAST(100, 100 - COALESCE((value->>'originalLensColorInfluence')::numeric, 15))))
      )
    ELSE value
  END
WHERE key = 'sunglasses.lens_render_defaults_v1';

UPDATE public.config_kv
SET value =
  value || jsonb_build_object(
    'reflectionRightOpacity', COALESCE(value->'reflectionRightOpacity', value->'reflectionOpacity', '0.2'::jsonb),
    'reflectionRightBlur', COALESCE(value->'reflectionRightBlur', value->'reflectionBlur', '0.58'::jsonb)
  )
WHERE key = 'sunglasses.lens_render_defaults_v1';

-- Presets
UPDATE public.lens_rendering_presets
SET settings =
  CASE
    WHEN settings ? 'glassBaseDensity' AND NOT (settings ? 'baseGlassDarkness')
      THEN (settings - 'glassBaseDensity') || jsonb_build_object('baseGlassDarkness', settings->'glassBaseDensity')
    ELSE settings
  END,
  updated_at = now();

UPDATE public.lens_rendering_presets
SET settings =
  CASE
    WHEN settings ? 'baseDensityBias' AND NOT (settings ? 'baseGlassRichness')
      THEN (settings - 'baseDensityBias') || jsonb_build_object('baseGlassRichness', settings->'baseDensityBias')
    ELSE settings
  END,
  updated_at = now();

UPDATE public.lens_rendering_presets
SET settings =
  CASE
    WHEN settings ? 'originalLensColorInfluence' AND NOT (settings ? 'baseGlassNeutralization')
      THEN settings || jsonb_build_object(
        'baseGlassNeutralization',
        to_jsonb(GREATEST(0, LEAST(100, 100 - COALESCE((settings->>'originalLensColorInfluence')::numeric, 15))))
      )
    ELSE settings
  END,
  updated_at = now();

UPDATE public.lens_rendering_presets
SET settings =
  settings || jsonb_build_object(
    'reflectionRightOpacity', COALESCE(settings->'reflectionRightOpacity', settings->'reflectionOpacity', '0.2'::jsonb),
    'reflectionRightBlur', COALESCE(settings->'reflectionRightBlur', settings->'reflectionBlur', '0.58'::jsonb)
  ),
  updated_at = now();

COMMIT;
