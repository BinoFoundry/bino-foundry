-- Persist frame plate path crop (BeadCropConfig v2) for lossless re-edit after processed export.

ALTER TABLE public.frame_render_views
  ADD COLUMN IF NOT EXISTS plate_crop_config JSONB;

COMMENT ON COLUMN public.frame_render_views.plate_crop_config IS
  'Closed path crop on original_plate_url (BeadCropConfig v1/v2). Processed plate_url is derived on save.';
