-- SVG lens clip paths for sunglasses tint compositing (replaces canvas mask bitmap workflow).
-- Does not modify prior migrations; adds columns + optional third view axis.

BEGIN;

ALTER TABLE public.frame_render_views
  DROP CONSTRAINT IF EXISTS frame_render_views_view_axis_check;

ALTER TABLE public.frame_render_views
  ADD CONSTRAINT frame_render_views_view_axis_check
  CHECK (view_axis IN ('front', 'side', 'three_quarter'));

ALTER TABLE public.frame_render_views
  ADD COLUMN IF NOT EXISTS clip_config JSONB,
  ADD COLUMN IF NOT EXISTS clip_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (clip_status IN ('draft', 'ready'));

COMMENT ON COLUMN public.frame_render_views.clip_config IS 'LensClipConfig v1 — SVG pathD per lens in image pixel space';
COMMENT ON COLUMN public.frame_render_views.clip_status IS 'draft until valid clip paths saved; ready when customiser may use svg-clip mode';
COMMENT ON COLUMN public.frame_render_views.mask_config IS 'Deprecated: legacy polygon anchors; prefer clip_config for new saves';

COMMIT;
