-- ============================================================================
-- Reset ALL lens-rendering opacity values to application defaults
-- ============================================================================
-- Non-destructive and idempotent: updates only clip_config.render keys. It does not delete
-- frames, plates, lens paths, exclusions, masks, or non-opacity rendering configuration.

BEGIN;

UPDATE public.frame_render_views
SET clip_config = jsonb_set(
      clip_config,
      '{render}',
      COALESCE(clip_config->'render', '{}'::jsonb) || jsonb_build_object(
        -- Direct tint path opacity (the SVG gradient reference remains internal).
        'tintLayerOpacity',      0.43,
        -- Legacy values retained at neutral defaults for older clients.
        'tintFilterOpacity',     1,
        'tintOpacity',           0.78,
        -- Glass/transmission opacity.
        'lensOpacity',           0.9,
        'lensTransmission',      0.42,
        'baseTintOpacity',       0.9,
        'transparency',          0.42,
        -- Surface optics opacity.
        'reflectionOpacity',     0.2,
        'reflectionStrength',    0.42,
        'glossIntensity',        0.14,
        'glossStrength',         0.14,
        'highlightStrength',     0.12,
        -- Edge/Fresnel opacity.
        'vignetteStrength',      0.12,
        'edgeFade',              0.12,
        'edgeDarkness',          0.24,
        -- Restored frame hardware opacity.
        'frameExclusionOpacity', 1,
        -- Optional polarized optical layer opacity.
        'polarizedStrength',     0.12
      ),
      true
    )
WHERE clip_config IS NOT NULL
  AND jsonb_typeof(clip_config) = 'object';

COMMIT;
