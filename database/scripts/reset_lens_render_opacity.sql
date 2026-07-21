-- ============================================================================
-- Reset lens rendering opacity parameters to defaults (idempotent, non-destructive)
-- ============================================================================
-- Resets EVERY opacity-based lens rendering parameter on all frame_render_views back to
-- the renderer defaults (DEFAULT_LENS_CLIP_RENDER). No lens clips, frame exclusions, masks,
-- plates, or other assets/configurations are deleted — only clip_config.render opacity keys
-- are overwritten. Non-opacity keys (gradient/reflection angles, toggles, brightness, etc.)
-- are left untouched. Safe to run multiple times.
--
-- Usage:  psql "$DATABASE_URL" -f database/scripts/reset_lens_render_opacity.sql

BEGIN;

UPDATE public.frame_render_views
SET clip_config = jsonb_set(
      clip_config,
      '{render}',
      COALESCE(clip_config->'render', '{}'::jsonb) || jsonb_build_object(
        'tintOpacity',           0.78,
        'tintFilterOpacity',     1,
        'lensOpacity',           0.9,
        'lensTransmission',      0.42,
        'frameExclusionOpacity', 1,
        'baseTintOpacity',       0.9,
        'transparency',          0.42,
        'reflectionOpacity',     0.2,
        'reflectionStrength',    0.42,
        'glossStrength',         0.14,
        'highlightStrength',     0.12,
        'edgeFade',              0.12,
        'edgeDarkness',          0.24
      ),
      true
    )
WHERE clip_config IS NOT NULL
  AND jsonb_typeof(clip_config) = 'object';

COMMIT;
