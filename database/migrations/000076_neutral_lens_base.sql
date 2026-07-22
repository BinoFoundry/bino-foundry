-- Per-view Neutral Lens Base asset for consistent tint rendering.
-- Generated once from the processed plate + lens clip geometry.
-- Never overwrites plate_url / original_plate_url.

ALTER TABLE public.frame_render_views
  ADD COLUMN IF NOT EXISTS neutral_lens_base_url TEXT,
  ADD COLUMN IF NOT EXISTS neutral_lens_base_source_hash TEXT,
  ADD COLUMN IF NOT EXISTS neutral_lens_base_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS use_neutral_lens_base BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.frame_render_views.neutral_lens_base_url IS
  'Cached plate-sized transparent PNG of the clipped lens openings converted to a neutral grey optical base.';
COMMENT ON COLUMN public.frame_render_views.neutral_lens_base_source_hash IS
  'Deterministic fingerprint of the plate URL, dimensions, lens paths, exclusions, and bake algorithm.';
COMMENT ON COLUMN public.frame_render_views.neutral_lens_base_updated_at IS
  'Timestamp of the last successful Neutral Lens Base generation.';
COMMENT ON COLUMN public.frame_render_views.use_neutral_lens_base IS
  'When TRUE and neutral_lens_base_url is present, the compositor paints the neutral base inside lens openings. When FALSE or the URL is missing, falls back to the original plate lens.';
