-- Soft-disable bead library sizes for new selections without deleting historical references.
-- Existing bracelet_configuration_items keep their bead_library_size_id FK.

BEGIN;

ALTER TABLE public.bead_library_sizes
  ADD COLUMN IF NOT EXISTS available_for_new BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.bead_library_sizes.available_for_new IS
  'When false, size remains for existing designs/orders but is hidden from new builder selections.';

CREATE INDEX IF NOT EXISTS idx_bead_library_sizes_available_for_new
  ON public.bead_library_sizes (bead_library_id)
  WHERE available_for_new = TRUE;

COMMIT;
