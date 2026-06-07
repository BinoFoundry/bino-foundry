-- Size-only pricing: remove bead_libraries.unit_price; pricing lives in bead_library_sizes.
BEGIN;

-- Backfill enabled sizes for libraries that have none (from legacy unit_price × multiplier).
INSERT INTO public.bead_library_sizes (
  bead_library_id,
  bead_size_id,
  unit_price,
  currency_code,
  is_default
)
SELECT
  bl.id,
  bs.id,
  ROUND(
    CASE
      WHEN COALESCE(bt.uses_size_pricing, FALSE) THEN bl.unit_price * bs.price_multiplier
      ELSE bl.unit_price
    END,
    4
  ),
  COALESCE(bl.currency_code, 'USD'),
  bs.is_default
FROM public.bead_libraries bl
JOIN public.bead_types bt ON bt.id = bl.bead_type_id
CROSS JOIN public.bead_sizes bs
WHERE bs.is_active = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM public.bead_library_sizes bls WHERE bls.bead_library_id = bl.id
  )
ON CONFLICT (bead_library_id, bead_size_id) DO NOTHING;

ALTER TABLE public.bead_libraries
  DROP COLUMN IF EXISTS unit_price;

COMMENT ON TABLE public.bead_libraries IS
  'Unified bead catalogue (one crop asset per bead). Sellable pricing lives in bead_library_sizes only.';

COMMIT;
