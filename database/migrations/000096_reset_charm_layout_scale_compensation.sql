-- Reset charm render calibration that was compensating for the old padded-canvas
-- dangling shell bug. Those overrides (layoutScale 0.4–0.6) now make same-mm charms
-- look ~half the size of crystals after content-width sizing was fixed.
-- Also restore crystal contactWidth to neutral (1); -2 collapses contact span to 0.

BEGIN;

-- Charm / pendant / locket library overrides: restore layoutScale to 1 when shrunk.
UPDATE public.bead_libraries AS bl
SET metadata = jsonb_set(
  COALESCE(bl.metadata, '{}'::jsonb),
  '{strandRenderOverride,layoutScale}',
  '1'::jsonb,
  true
)
FROM public.bead_types AS bt
WHERE bl.bead_type_id = bt.id
  AND bt.slug IN ('charm', 'pendant', 'locket')
  AND bl.metadata ? 'strandRenderOverride'
  AND COALESCE(bl.metadata->>'useTypeStrandDefaults', 'true') = 'false'
  AND COALESCE((bl.metadata->'strandRenderOverride'->>'layoutScale')::numeric, 1) < 0.95;

-- Matching visualScale tweaks that were paired with the shrink (keep intentional >1 alone).
UPDATE public.bead_libraries AS bl
SET metadata = jsonb_set(
  COALESCE(bl.metadata, '{}'::jsonb),
  '{strandRenderOverride,visualScale}',
  '1'::jsonb,
  true
)
FROM public.bead_types AS bt
WHERE bl.bead_type_id = bt.id
  AND bt.slug IN ('charm', 'pendant', 'locket')
  AND bl.metadata ? 'strandRenderOverride'
  AND COALESCE(bl.metadata->>'useTypeStrandDefaults', 'true') = 'false'
  AND COALESCE((bl.metadata->'strandRenderOverride'->>'visualScale')::numeric, 1) < 0.95;

-- Crystal (and round-bead family): contactWidth -2 → span multiplier 0. Restore neutral touch.
UPDATE public.bead_types
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{strandRender,contactWidth}',
  '1'::jsonb,
  true
)
WHERE slug IN ('crystal', 'gemstone', 'accent', 'round-bead', 'bead', 'stone', 'spacer')
  AND COALESCE((metadata->'strandRender'->>'contactWidth')::numeric, 1) < 0;

COMMIT;
