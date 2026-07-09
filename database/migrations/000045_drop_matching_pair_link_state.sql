-- Roll back matching-pair link editing columns (000044).
-- UP: remove UI-only flags — match state is derived from bracelet B contents.
BEGIN;

ALTER TABLE public.bracelet_configurations
  DROP COLUMN IF EXISTS matching_pair_linked,
  DROP COLUMN IF EXISTS active_bracelet;

COMMIT;
