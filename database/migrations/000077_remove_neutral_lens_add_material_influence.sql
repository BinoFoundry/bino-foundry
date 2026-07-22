-- Retire the generated Neutral Lens Base workflow and return to one plate-based renderer.
-- Migration 000076 may already be deployed, so cleanup must remain append-only.

ALTER TABLE public.frame_render_views
  DROP COLUMN IF EXISTS neutral_lens_base_url,
  DROP COLUMN IF EXISTS neutral_lens_base_source_hash,
  DROP COLUMN IF EXISTS neutral_lens_base_updated_at,
  DROP COLUMN IF EXISTS use_neutral_lens_base;

-- Replace source-colour retention controls with one deterministic material-detail control.
-- Material Influence preserves luminance structure only; original lens chroma is never reused.
UPDATE public.lens_rendering_presets
SET settings =
  (
    settings
      - 'glassMaterialStrength'
      - 'baseSaturation'
  ) || jsonb_build_object(
    'materialInfluence',
    COALESCE((settings->>'materialInfluence')::numeric, 35)
  );

UPDATE public.frame_render_views
SET clip_config = jsonb_set(
  clip_config,
  '{render}',
  (
    (clip_config->'render')
      - 'glassMaterialStrength'
      - 'baseSaturation'
  ) || jsonb_build_object(
    'materialInfluence',
    COALESCE((clip_config->'render'->>'materialInfluence')::numeric, 35)
  ),
  true
)
WHERE clip_config IS NOT NULL
  AND jsonb_typeof(clip_config->'render') = 'object';

COMMENT ON COLUMN public.lens_rendering_presets.settings IS
  'Deterministic lens material JSON. materialInfluence (0..100) controls preserved source luminance detail beneath the selected tint; source lens chroma is removed.';
