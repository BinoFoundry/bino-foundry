-- Bracelet render calibration: ensure charm occupancy matches capacity (contactWidth = 1)
-- and dangling charms use a sensible visualScale baseline when still at the old collapsed values.
-- Also normalize bead_sizes labels to use a decimal point (not comma).

BEGIN;

-- Charm / pendant / locket: occupancy must equal catalogue sizeMm (contactWidth 1).
UPDATE public.bead_types
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{strandRender,contactWidth}',
  '1'::jsonb,
  true
)
WHERE slug IN ('charm', 'pendant', 'locket')
  AND COALESCE((metadata->'strandRender'->>'contactWidth')::numeric, 1) < 0.5;

-- Ensure dangling layout mode remains set for charm-like types.
UPDATE public.bead_types
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{strandRender,layoutMode}',
  '"dangling"'::jsonb,
  true
)
WHERE slug IN ('charm', 'pendant', 'locket')
  AND COALESCE(metadata->'strandRender'->>'layoutMode', '') <> 'dangling';

-- Bead size labels: replace locale commas with decimal points (e.g. "2,5 mm" → "2.5 mm").
UPDATE public.bead_sizes
SET label = replace(label, ',', '.')
WHERE label LIKE '%,%';

COMMIT;
