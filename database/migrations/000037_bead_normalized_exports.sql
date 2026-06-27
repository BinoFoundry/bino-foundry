-- Per-mm-group pre-normalized export URLs (save-time asset normalization).
BEGIN;

ALTER TABLE public.bead_library_sizes
  ADD COLUMN IF NOT EXISTS normalized_processed_image_url TEXT,
  ADD COLUMN IF NOT EXISTS normalized_delivery_urls JSONB,
  ADD COLUMN IF NOT EXISTS normalized_visible_diameter_px NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS needs_normalized_reexport BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.bead_library_sizes.normalized_processed_image_url IS
  'Processed export scaled so visible footprint matches bead_sizes.group_reference_diameter_px for this mm group.';

COMMENT ON COLUMN public.bead_library_sizes.normalized_visible_diameter_px IS
  'Visible silhouette diameter (px) baked into normalized_processed_image_url — equals group reference after export.';

COMMENT ON COLUMN public.bead_library_sizes.needs_normalized_reexport IS
  'True when group reference changed or crop updated; admin export pipeline should regenerate normalized asset.';

COMMIT;
