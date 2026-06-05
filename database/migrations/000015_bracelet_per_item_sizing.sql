-- Per-item bead sizing: default_bead_size_mm is optional (placement hint only, not strand sizing).
BEGIN;

ALTER TABLE public.bracelet_configurations
  ALTER COLUMN default_bead_size_mm DROP NOT NULL;

COMMENT ON COLUMN public.bracelet_configurations.default_bead_size_mm IS
  'Optional UI hint for new placements. Strand length and fit use bracelet_configuration_items.bead_size_mm.';

COMMENT ON COLUMN public.bracelet_configuration_items.bead_size_mm IS
  'Physical diameter (mm) for this slot; references bead_sizes.size_mm catalog values.';

COMMIT;
