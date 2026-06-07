-- Remove legacy multiplier-based pricing; pricing lives only on bead_library_sizes.unit_price.
BEGIN;

ALTER TABLE public.bead_sizes
  DROP COLUMN IF EXISTS price_multiplier;

ALTER TABLE public.bead_types
  DROP COLUMN IF EXISTS uses_size_pricing;

DELETE FROM public.config_kv
WHERE key = 'bracelet.pricing_v1';

COMMENT ON TABLE public.bead_sizes IS
  'Bracelet builder bead diameter options (mm). Wrist fit uses true mm; visual scale is display-only in the app.';

COMMENT ON TABLE public.bead_types IS
  'Bead categories (Crystal, Charm, Spacer, …). Pricing is per bead library size variant, not per type.';

COMMIT;
