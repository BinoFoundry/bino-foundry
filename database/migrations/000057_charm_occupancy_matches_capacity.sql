-- Charm / pendant / locket occupancy must match the capacity panel (catalogue sizeMm).
-- contactWidth 0.08 collapsed full bracelets into a small arc while capacity reported 100%.
-- Dangling remains visual-only via layoutMode + loop anchor; it must not shrink the arc.

BEGIN;

UPDATE public.bead_types
SET metadata = jsonb_set(
  metadata,
  '{strandRender,contactWidth}',
  '1'::jsonb,
  true
)
WHERE slug IN ('charm', 'pendant', 'locket')
  AND COALESCE((metadata->'strandRender'->>'contactWidth')::numeric, 1) < 0.5;

COMMIT;
