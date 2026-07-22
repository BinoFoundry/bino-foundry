-- Replace the low-value base preprocessing controls with one meaningful optical-glass
-- master control. Keep migrations append-only: v000073 may already have been applied.

UPDATE public.lens_rendering_presets
SET settings =
  (
    settings
      - 'baseExposure'
      - 'baseContrast'
      - 'baseNeutralization'
  ) || jsonb_build_object(
    'glassMaterialStrength',
    COALESCE((settings->>'glassMaterialStrength')::numeric, 65)
  );

-- Remove obsolete sparse frame overrides without forcing a per-frame material strength;
-- frames continue to inherit strength from their assigned preset.
UPDATE public.frame_render_views
SET clip_config = jsonb_set(
  clip_config,
  '{render}',
  (clip_config->'render')
    - 'baseExposure'
    - 'baseContrast'
    - 'baseNeutralization',
  true
)
WHERE clip_config IS NOT NULL
  AND jsonb_typeof(clip_config->'render') = 'object'
  AND (
    clip_config->'render' ? 'baseExposure'
    OR clip_config->'render' ? 'baseContrast'
    OR clip_config->'render' ? 'baseNeutralization'
  );

COMMENT ON COLUMN public.lens_rendering_presets.settings IS
  'Lens material JSON including glassMaterialStrength (0..100), tint, opacity, reflection, edge, transparency, and density controls.';
