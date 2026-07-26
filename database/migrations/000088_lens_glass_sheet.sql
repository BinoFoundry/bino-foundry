-- Glass sheet replacement for lens compositing.
-- When glassSheetEnabled is true and a sheet URL is set, the original lens is
-- replaced with sheet texture + customer tint (no darken-then-tint).
-- Occluder defaults OFF.

BEGIN;

UPDATE public.config_kv
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'glassSheetEnabled', COALESCE(value->'glassSheetEnabled', 'false'::jsonb),
  'glassSheetUrl', COALESCE(value->'glassSheetUrl', 'null'::jsonb),
  'glassSheetFit', COALESCE(value->'glassSheetFit', '"cover"'::jsonb),
  'glassSheetScale', COALESCE(value->'glassSheetScale', '1'::jsonb),
  'glassSheetOffsetX', COALESCE(value->'glassSheetOffsetX', '0'::jsonb),
  'glassSheetOffsetY', COALESCE(value->'glassSheetOffsetY', '0'::jsonb),
  'glassSheetColorStrength', COALESCE(value->'glassSheetColorStrength', '85'::jsonb),
  'glassSheetTextureStrength', COALESCE(value->'glassSheetTextureStrength', '55'::jsonb),
  'glassSheetShine', COALESCE(value->'glassSheetShine', '40'::jsonb),
  'glassSheetOccluderEnabled', COALESCE(value->'glassSheetOccluderEnabled', 'false'::jsonb),
  'glassSheetOccluderStrength', COALESCE(value->'glassSheetOccluderStrength', '70'::jsonb),
  'glassSheetOccluderThreshold', COALESCE(value->'glassSheetOccluderThreshold', '42'::jsonb)
)
WHERE key = 'sunglasses.lens_render_defaults_v1';

UPDATE public.lens_rendering_presets
SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
  'glassSheetEnabled', COALESCE(settings->'glassSheetEnabled', 'false'::jsonb),
  'glassSheetOccluderEnabled', COALESCE(settings->'glassSheetOccluderEnabled', 'false'::jsonb)
)
WHERE NOT (COALESCE(settings, '{}'::jsonb) ? 'glassSheetEnabled');

COMMIT;
