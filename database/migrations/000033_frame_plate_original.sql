-- Preserve original frame plate uploads separately from processed (cropped) plates.

ALTER TABLE public.frame_render_views
  ADD COLUMN IF NOT EXISTS original_plate_url TEXT,
  ADD COLUMN IF NOT EXISTS original_image_width INTEGER,
  ADD COLUMN IF NOT EXISTS original_image_height INTEGER;

COMMENT ON COLUMN public.frame_render_views.original_plate_url IS
  'Untouched upload URL; plate_url holds the processed (cropped) plate for compositing.';
COMMENT ON COLUMN public.frame_render_views.original_image_width IS
  'Pixel width of original_plate_url when stored.';
COMMENT ON COLUMN public.frame_render_views.original_image_height IS
  'Pixel height of original_plate_url when stored.';
