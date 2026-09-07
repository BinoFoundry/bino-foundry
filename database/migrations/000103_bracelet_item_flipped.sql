-- Asymmetric pieces the customer turned around by hand.
--
-- A bead cap sitting between two beads has no facing the layout can infer —
-- both arrangements are identical to the strand — so the choice belongs to the
-- person designing, and has to be recorded or the bracelet is strung wrong.
--
-- Nullable with a false default: every design saved before this reads as
-- "not turned", which is exactly what it was.

BEGIN;

ALTER TABLE public.bracelet_configuration_items
  ADD COLUMN IF NOT EXISTS is_flipped BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.bracelet_configuration_items.is_flipped IS
  'Customer turned this piece around; it is to be strung facing this way.';

COMMIT;
