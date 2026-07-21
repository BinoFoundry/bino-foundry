-- Lens rendering presets: named, editable DB records that frames inherit.
-- Hierarchy at resolve time: Frame Override → Preset → System Default (code).
-- Do not edit prior migrations; this file is additive only.

BEGIN;

CREATE TABLE public.lens_rendering_presets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  settings        JSONB NOT NULL DEFAULT '{}'::jsonb,
  display_order   INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lens_rendering_presets_name_trim CHECK (trim(name) <> ''),
  CONSTRAINT lens_rendering_presets_code_trim CHECK (trim(code) <> '')
);

-- At most one default preset.
CREATE UNIQUE INDEX idx_lens_rendering_presets_one_default
  ON public.lens_rendering_presets ((is_default))
  WHERE is_default = TRUE;

CREATE INDEX idx_lens_rendering_presets_active_sort
  ON public.lens_rendering_presets (is_active, display_order, name);

CREATE TRIGGER trg_lens_rendering_presets_updated_at
  BEFORE UPDATE ON public.lens_rendering_presets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON TABLE public.lens_rendering_presets IS
  'Named lens optical material presets. Frames inherit settings unless they opt into sparse overrides.';
COMMENT ON COLUMN public.lens_rendering_presets.settings IS
  'LensClipRenderSettings JSON (tintLayerOpacity, lensOpacity, reflectionOpacity, edgeDarkness, backgroundVisibility, environmentTransparency, centerDensity, edgeDensity, …).';

-- Frame assignment + inherit toggle.
ALTER TABLE public.frames
  ADD COLUMN IF NOT EXISTS lens_render_preset_id UUID
    REFERENCES public.lens_rendering_presets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS use_lens_render_preset BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_frames_lens_render_preset
  ON public.frames (lens_render_preset_id);

COMMENT ON COLUMN public.frames.lens_render_preset_id IS
  'Assigned lens rendering preset. NULL falls back to the is_default preset, then code defaults.';
COMMENT ON COLUMN public.frames.use_lens_render_preset IS
  'When TRUE, frame inherits all preset values (clip_config.render material keys ignored). When FALSE, sparse overrides in clip_config.render apply on top of the preset.';

-- Seed editable presets (not hardcoded in JS). Values mirror current renderer defaults
-- with intentional density variants for dark / medium / fashion / clear looks.
INSERT INTO public.lens_rendering_presets (code, name, description, display_order, is_default, settings)
VALUES
  (
    'dark-sunglasses',
    'Dark Sunglasses',
    'Strong tint density for classic dark lenses.',
    10,
    FALSE,
    jsonb_build_object(
      'tintLayerOpacity', 0.62,
      'lensOpacity', 0.95,
      'reflectionOpacity', 0.18,
      'edgeDarkness', 0.32,
      'backgroundVisibility', 0,
      'environmentTransparency', 0,
      'centerDensity', 0.12,
      'edgeDensity', 0.28
    )
  ),
  (
    'medium-tint',
    'Medium Tint',
    'Balanced everyday sunglass optics (system default).',
    20,
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
    'fashion-tint',
    'Fashion Tint',
    'Lighter tint with more background visibility for fashion frames.',
    30,
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
  ),
  (
    'clear-lens',
    'Clear Lens',
    'Near-clear optical glass with minimal tint density.',
    40,
    FALSE,
    jsonb_build_object(
      'tintLayerOpacity', 0.12,
      'lensOpacity', 0.45,
      'reflectionOpacity', 0.16,
      'edgeDarkness', 0.14,
      'backgroundVisibility', 0.35,
      'environmentTransparency', 0.4,
      'centerDensity', 0,
      'edgeDensity', 0.08
    )
  )
ON CONFLICT (code) DO NOTHING;

-- Assign default preset to all frames that have none yet.
UPDATE public.frames f
SET lens_render_preset_id = p.id
FROM public.lens_rendering_presets p
WHERE p.is_default = TRUE
  AND f.lens_render_preset_id IS NULL;

-- Frames that already store custom clip_config.render material keep overrides enabled
-- so existing per-frame tuning is not silently discarded.
UPDATE public.frames f
SET use_lens_render_preset = FALSE
WHERE EXISTS (
  SELECT 1
  FROM public.frame_render_views v
  WHERE v.frame_id = f.id
    AND v.clip_config IS NOT NULL
    AND jsonb_typeof(v.clip_config->'render') = 'object'
    AND (
      (v.clip_config->'render' ? 'tintLayerOpacity')
      OR (v.clip_config->'render' ? 'lensOpacity')
      OR (v.clip_config->'render' ? 'reflectionOpacity')
      OR (v.clip_config->'render' ? 'edgeDarkness')
      OR (v.clip_config->'render' ? 'backgroundVisibility')
      OR (v.clip_config->'render' ? 'environmentTransparency')
      OR (v.clip_config->'render' ? 'centerDensity')
      OR (v.clip_config->'render' ? 'edgeDensity')
      OR (v.clip_config->'render' ? 'tintOpacity')
      OR (v.clip_config->'render' ? 'baseTintOpacity')
    )
);

COMMENT ON COLUMN public.frame_render_views.clip_config IS
  'LensClipConfig v1 JSON per view. Geometry (lenses, frameExclusions) always applies. Material keys under render are sparse frame overrides applied only when frames.use_lens_render_preset is FALSE; otherwise the assigned lens_rendering_presets.settings (then code defaults) supply optical values. Hierarchy: Frame Override → Preset → System Default.';

COMMIT;
