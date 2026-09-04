-- Halo frames: a decorative surround attached to a bead rather than a slot of its own.
--
-- Two parts:
--   1. Allow bead_types.placement_mode = 'frame' (000093 only knew replace / insert_between).
--   2. Record the frame on the bead it wraps in bracelet_configuration_items.
--
-- The frame columns are nullable — every design saved before this migration keeps
-- working untouched, and a bead without a frame stores NULL.

BEGIN;

ALTER TABLE public.bead_types
  DROP CONSTRAINT IF EXISTS bead_types_placement_mode_check;

ALTER TABLE public.bead_types
  ADD CONSTRAINT bead_types_placement_mode_check
  CHECK (placement_mode IN ('replace', 'insert_between', 'frame'));

-- ON DELETE SET NULL matches the bead columns (000041): a force-deleted bead
-- leaves the saved design intact, identified by the public id snapshot.
ALTER TABLE public.bracelet_configuration_items
  ADD COLUMN IF NOT EXISTS frame_bead_library_id UUID
    REFERENCES public.bead_libraries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS frame_bead_library_size_id UUID
    REFERENCES public.bead_library_sizes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS frame_bead_size_mm NUMERIC(10, 4),
  ADD COLUMN IF NOT EXISTS frame_unit_price_snapshot NUMERIC(14, 4),
  ADD COLUMN IF NOT EXISTS frame_bead_library_public_id_snapshot TEXT;

ALTER TABLE public.bracelet_configuration_items
  DROP CONSTRAINT IF EXISTS bracelet_configuration_items_frame_size_mm_positive;

ALTER TABLE public.bracelet_configuration_items
  ADD CONSTRAINT bracelet_configuration_items_frame_size_mm_positive
  CHECK (frame_bead_size_mm IS NULL OR frame_bead_size_mm > 0);

ALTER TABLE public.bracelet_configuration_items
  DROP CONSTRAINT IF EXISTS bracelet_configuration_items_frame_price_non_negative;

ALTER TABLE public.bracelet_configuration_items
  ADD CONSTRAINT bracelet_configuration_items_frame_price_non_negative
  CHECK (frame_unit_price_snapshot IS NULL OR frame_unit_price_snapshot >= 0);

CREATE INDEX IF NOT EXISTS idx_bracelet_configuration_items_frame
  ON public.bracelet_configuration_items (frame_bead_library_id)
  WHERE frame_bead_library_id IS NOT NULL;

COMMENT ON COLUMN public.bracelet_configuration_items.frame_bead_library_id IS
  'Optional halo/frame wrapping this bead. Takes no slot and never affects strand capacity.';
COMMENT ON COLUMN public.bracelet_configuration_items.frame_unit_price_snapshot IS
  'Frame price at save time; added to the bead price for the line total.';

COMMIT;
