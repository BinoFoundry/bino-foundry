-- Per-type flag: whether bead size multipliers apply to unit price.
BEGIN;

ALTER TABLE public.bead_types
  ADD COLUMN IF NOT EXISTS uses_size_pricing BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.bead_types.uses_size_pricing IS
  'When true, bracelet builder multiplies unit_price by the selected bead_sizes.price_multiplier';

UPDATE public.bead_types
SET uses_size_pricing = TRUE
WHERE slug IN ('crystal', 'accent');

-- Prefer slugs already configured in legacy bracelet.pricing_v1 when present.
UPDATE public.bead_types AS bt
SET uses_size_pricing = TRUE
FROM public.config_kv AS cfg
WHERE cfg.key = 'bracelet.pricing_v1'
  AND cfg.value ? 'sizePricedTypeSlugs'
  AND bt.slug IN (
    SELECT jsonb_array_elements_text(cfg.value->'sizePricedTypeSlugs')
  );

COMMIT;
