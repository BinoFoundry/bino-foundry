-- Reset all lens render controls to the exact current renderer defaults, including the
-- fully-synthetic pipeline controls (backgroundVisibility, environmentTransparency,
-- centerDensity, edgeDensity). Non-destructive/idempotent: only clip_config.render keys merge.

BEGIN;

UPDATE public.frame_render_views
SET clip_config = jsonb_set(
      clip_config,
      '{render}',
      COALESCE(clip_config->'render', '{}'::jsonb) || jsonb_build_object(
        'renderScope',             'global',
        'tintLayerOpacity',        0.42978,
        'tintFilterOpacity',       1,
        'tintOpacity',             0.78,
        'lensOpacity',             0.9,
        'lensTransmission',        0.42,
        'baseTintOpacity',         0.9,
        'transparency',            0.42,
        'reflectionOpacity',       0.2,
        'reflectionStrength',      0.42,
        'vignetteStrength',        0.12,
        'edgeFade',                0.12,
        'edgeDarkness',            0.24,
        'backgroundVisibility',    0,
        'environmentTransparency', 0,
        'centerDensity',           0,
        'edgeDensity',             0.18,
        'frameExclusionOpacity',   1,
        'polarizedStrength',       0.12
      ),
      true
    )
WHERE clip_config IS NOT NULL
  AND jsonb_typeof(clip_config) = 'object';

COMMIT;
