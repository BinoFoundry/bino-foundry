-- Automatic Inner Frame — inset ring derived from each lens polygon.
-- Settings live in clip_config.render / lens_rendering_presets.settings / config_kv.

BEGIN;

UPDATE public.config_kv
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'innerFrameEnabled', COALESCE(value->'innerFrameEnabled', 'true'::jsonb),
  'innerFrameThickness', COALESCE(value->'innerFrameThickness', '2'::jsonb),
  'innerFrameOpacity', COALESCE(value->'innerFrameOpacity', '70'::jsonb),
  'innerFrameFeather', COALESCE(value->'innerFrameFeather', '25'::jsonb),
  'innerFrameBlendMode', COALESCE(value->'innerFrameBlendMode', '"normal"'::jsonb)
)
WHERE key = 'sunglasses.lens_render_defaults_v1';

UPDATE public.lens_rendering_presets
SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
  'innerFrameEnabled', COALESCE(settings->'innerFrameEnabled', 'true'::jsonb),
  'innerFrameThickness', COALESCE(settings->'innerFrameThickness', '2'::jsonb),
  'innerFrameOpacity', COALESCE(settings->'innerFrameOpacity', '70'::jsonb),
  'innerFrameFeather', COALESCE(settings->'innerFrameFeather', '25'::jsonb),
  'innerFrameBlendMode', COALESCE(settings->'innerFrameBlendMode', '"normal"'::jsonb)
)
WHERE NOT (COALESCE(settings, '{}'::jsonb) ? 'innerFrameEnabled');

COMMENT ON COLUMN public.frame_render_views.clip_config IS
  'Lens clip polygons + render settings. render.innerFrame* controls the automatic inset lip derived from each lens pathD.';

COMMIT;
