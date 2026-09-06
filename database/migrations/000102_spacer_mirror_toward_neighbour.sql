-- Bead caps face the bead they sit against.
--
-- A cap is not symmetrical along the cord: on one side of a bead it opens left,
-- on the other it opens right. Rather than making the shop upload and the
-- customer choose between two near-identical items, the builder mirrors the
-- single uploaded image based on where the piece lands.
--
-- Enabled here for spacers, the type bead caps belong to. Purely visual — it
-- changes no geometry, spacing or capacity.

BEGIN;

UPDATE public.bead_types
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{strandRender,mirrorTowardNeighbour}',
  'true'::jsonb,
  true
)
WHERE LOWER(slug) = 'spacer'
  AND COALESCE(metadata #>> '{strandRender,mirrorTowardNeighbour}', 'false') <> 'true';

COMMIT;
