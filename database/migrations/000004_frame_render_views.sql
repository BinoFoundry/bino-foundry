-- Per-frame render plates + polygon lens masks (front / side views).
-- Aligns with bino-rendering MaskConfig workflow; plates live in Storage via assets.

BEGIN;

CREATE TABLE IF NOT EXISTS public.frame_render_views (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  frame_id        UUID NOT NULL REFERENCES public.frames(id) ON DELETE CASCADE,
  view_axis       TEXT NOT NULL CHECK (view_axis IN ('front', 'side')),
  plate_asset_id  UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  plate_url       TEXT NOT NULL,
  image_width     INTEGER NOT NULL CHECK (image_width > 0),
  image_height    INTEGER NOT NULL CHECK (image_height > 0),
  mask_config     JSONB,
  mask_status     TEXT NOT NULL DEFAULT 'draft'
                  CHECK (mask_status IN ('draft', 'ready')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT frame_render_views_unique_axis UNIQUE (frame_id, view_axis)
);

CREATE INDEX idx_frame_render_views_frame ON public.frame_render_views (frame_id);

COMMENT ON TABLE public.frame_render_views IS 'Masked photo plates per view; mask_config matches frontend MaskConfig v2';
COMMENT ON COLUMN public.frame_render_views.mask_config IS 'Normalized lens polygons (left/right); null until editor save';
COMMENT ON COLUMN public.frame_render_views.plate_url IS 'Public URL for source plate (denormalized for fast SPA reads)';

DROP TRIGGER IF EXISTS trg_frame_render_views_updated_at ON public.frame_render_views;
CREATE TRIGGER trg_frame_render_views_updated_at
  BEFORE UPDATE ON public.frame_render_views
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMIT;
