-- Per-mm-group largest visible diameter reference + per-library-size normalization factors.
BEGIN;

ALTER TABLE public.bead_sizes
  ADD COLUMN IF NOT EXISTS group_reference_diameter_px NUMERIC(12, 4);

COMMENT ON COLUMN public.bead_sizes.group_reference_diameter_px IS
  'Largest visible crop diameter (px) among bead libraries enabled for this mm size; drives group normalization.';

ALTER TABLE public.bead_library_sizes
  ADD COLUMN IF NOT EXISTS normalization_factor NUMERIC(12, 6) NOT NULL DEFAULT 1
    CHECK (normalization_factor > 0);

ALTER TABLE public.bead_library_sizes
  ADD COLUMN IF NOT EXISTS asset_visible_diameter_px NUMERIC(12, 4);

COMMENT ON COLUMN public.bead_library_sizes.normalization_factor IS
  'group_reference_diameter_px / asset_visible_diameter_px for this library at this mm size.';

COMMENT ON COLUMN public.bead_library_sizes.asset_visible_diameter_px IS
  'Cached visible silhouette diameter from crop metadata when factors were last computed.';

COMMIT;
