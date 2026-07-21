-- Simplify lens rendering presets to four built-in starting points.
-- Classic Tint is the global default. Built-in rows are marked is_system (not deletable).
-- Does not edit prior migrations. Renderer pipeline unchanged.

BEGIN;

ALTER TABLE public.lens_rendering_presets
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.lens_rendering_presets.is_system IS
  'Built-in presets (Clear / Light / Classic / Dark). Editable and renameable, but not deletable.';

-- Retire earlier seed catalogs; keep rows inactive so FKs remain valid until reassigned.
UPDATE public.lens_rendering_presets
SET is_active = FALSE,
    is_default = FALSE,
    updated_at = now()
WHERE code NOT IN ('clear', 'light-tint', 'classic-tint', 'dark-tint');

UPDATE public.lens_rendering_presets SET is_default = FALSE WHERE is_default = TRUE;

INSERT INTO public.lens_rendering_presets (
  code, name, description, display_order, is_default, is_active, is_system, settings
)
VALUES
  (
    'clear',
    'Clear',
    'Near-clear optics; original lens texture dominates.',
    10,
    FALSE,
    TRUE,
    TRUE,
    jsonb_build_object(
      'tintLayerOpacity', 0.12,
      'lensOpacity', 0.45,
      'reflectionOpacity', 0.14,
      'edgeDarkness', 0.12,
      'backgroundVisibility', 0.35,
      'environmentTransparency', 0.4,
      'centerDensity', 0,
      'edgeDensity', 0.06
    )
  ),
  (
    'light-tint',
    'Light Tint',
    'Light everyday tint with clear glass depth.',
    20,
    FALSE,
    TRUE,
    TRUE,
    jsonb_build_object(
      'tintLayerOpacity', 0.28,
      'lensOpacity', 0.72,
      'reflectionOpacity', 0.18,
      'edgeDarkness', 0.16,
      'backgroundVisibility', 0.12,
      'environmentTransparency', 0.16,
      'centerDensity', 0,
      'edgeDensity', 0.1
    )
  ),
  (
    'classic-tint',
    'Classic Tint',
    'Balanced classic sunglass optics (global default).',
    30,
    TRUE,
    TRUE,
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
    'dark-tint',
    'Dark Tint',
    'Strong dark tint for deep sunglass lenses.',
    40,
    FALSE,
    TRUE,
    TRUE,
    jsonb_build_object(
      'tintLayerOpacity', 0.62,
      'lensOpacity', 0.95,
      'reflectionOpacity', 0.18,
      'edgeDarkness', 0.32,
      'backgroundVisibility', 0,
      'environmentTransparency', 0,
      'centerDensity', 0.1,
      'edgeDensity', 0.26
    )
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_default = EXCLUDED.is_default,
  is_active = TRUE,
  is_system = TRUE,
  settings = EXCLUDED.settings,
  updated_at = now();

-- Reassign frames that pointed at retired presets (or null) to Classic Tint when inheriting.
UPDATE public.frames f
SET lens_render_preset_id = classic.id
FROM public.lens_rendering_presets classic
WHERE classic.code = 'classic-tint'
  AND (
    f.lens_render_preset_id IS NULL
    OR f.lens_render_preset_id IN (
      SELECT id FROM public.lens_rendering_presets
      WHERE is_active = FALSE OR code NOT IN ('clear', 'light-tint', 'classic-tint', 'dark-tint')
    )
  );

COMMENT ON TABLE public.lens_rendering_presets IS
  'Lens optical parameter presets. Four built-in starting points (Clear, Light Tint, Classic Tint, Dark Tint); admins may add more. Presets never lock frame sliders — editing a slider stores custom frame settings.';

COMMIT;
