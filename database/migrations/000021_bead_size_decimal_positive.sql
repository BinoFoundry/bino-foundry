-- Allow any positive bead size (decimals supported); drop 4–24 mm limits.
BEGIN;

ALTER TABLE public.bead_sizes
  DROP CONSTRAINT IF EXISTS bead_sizes_size_mm_check;

ALTER TABLE public.bead_sizes
  ALTER COLUMN size_mm TYPE NUMERIC(10, 4) USING size_mm::NUMERIC(10, 4);

ALTER TABLE public.bead_sizes
  ADD CONSTRAINT bead_sizes_size_mm_positive CHECK (size_mm > 0);

ALTER TABLE public.bracelet_configuration_items
  DROP CONSTRAINT IF EXISTS bracelet_configuration_items_bead_size_mm_check;

ALTER TABLE public.bracelet_configuration_items
  ALTER COLUMN bead_size_mm TYPE NUMERIC(10, 4) USING bead_size_mm::NUMERIC(10, 4);

ALTER TABLE public.bracelet_configuration_items
  ADD CONSTRAINT bracelet_configuration_items_bead_size_mm_positive CHECK (bead_size_mm > 0);

ALTER TABLE public.bracelet_configurations
  DROP CONSTRAINT IF EXISTS bracelet_configurations_default_bead_size_mm_check;

ALTER TABLE public.bracelet_configurations
  ALTER COLUMN default_bead_size_mm TYPE NUMERIC(10, 4) USING default_bead_size_mm::NUMERIC(10, 4);

ALTER TABLE public.bracelet_configurations
  ADD CONSTRAINT bracelet_configurations_default_bead_size_mm_positive
  CHECK (default_bead_size_mm IS NULL OR default_bead_size_mm > 0);

COMMENT ON COLUMN public.bead_sizes.size_mm IS
  'Bead diameter in millimeters; any positive value (decimals allowed).';

COMMIT;
