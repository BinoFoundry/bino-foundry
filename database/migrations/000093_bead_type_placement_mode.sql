-- Database-driven bracelet placement mode (replace vs insert_between).
-- Replaces hardcoded category-name checks in the builder (charm / crystal / …).

BEGIN;

ALTER TABLE public.bead_types
  ADD COLUMN IF NOT EXISTS placement_mode VARCHAR(30) NOT NULL DEFAULT 'replace';

-- Constrain to known modes (drop first if re-run after partial apply).
ALTER TABLE public.bead_types
  DROP CONSTRAINT IF EXISTS bead_types_placement_mode_check;

ALTER TABLE public.bead_types
  ADD CONSTRAINT bead_types_placement_mode_check
  CHECK (placement_mode IN ('replace', 'insert_between'));

-- Seed by slug (canonical) and by lower(name) for legacy label variants.
UPDATE public.bead_types
SET placement_mode = 'replace'
WHERE LOWER(slug) IN ('crystal', 'spacer', 'accent', 'gemstone', 'round-bead')
   OR LOWER(name) IN ('crystal', 'spacer', 'accent');

UPDATE public.bead_types
SET placement_mode = 'insert_between'
WHERE LOWER(slug) IN ('charm', 'separator', 'connector', 'pendant', 'locket')
   OR LOWER(name) IN ('charm', 'separator', 'connector');

COMMIT;
