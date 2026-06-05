-- Per-library size/price variants (one crop asset, many sellable variants).
BEGIN;

CREATE TABLE IF NOT EXISTS public.bead_variants (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id         TEXT NOT NULL UNIQUE,
  bead_library_id   UUID NOT NULL REFERENCES public.bead_libraries(id) ON DELETE CASCADE,
  size_mm           SMALLINT NOT NULL CHECK (size_mm >= 4 AND size_mm <= 24),
  unit_price        NUMERIC(14, 4) NOT NULL CHECK (unit_price >= 0),
  currency_code     TEXT NOT NULL DEFAULT 'USD' CHECK (char_length(currency_code) = 3),
  label             TEXT NOT NULL DEFAULT '',
  display_order     INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  is_default        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bead_variants_public_id_trim CHECK (trim(public_id) <> ''),
  CONSTRAINT bead_variants_unique_library_size UNIQUE (bead_library_id, size_mm)
);

CREATE INDEX IF NOT EXISTS idx_bead_variants_library_active
  ON public.bead_variants (bead_library_id, is_active, display_order, size_mm);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bead_variants_single_default
  ON public.bead_variants (bead_library_id) WHERE is_default = TRUE;

DROP TRIGGER IF EXISTS trg_bead_variants_updated_at ON public.bead_variants;
CREATE TRIGGER trg_bead_variants_updated_at
  BEFORE UPDATE ON public.bead_variants
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON TABLE public.bead_variants IS 'Sellable size/price variant for a bead_libraries asset (shared crop)';
COMMENT ON COLUMN public.bead_variants.unit_price IS 'Variant price at checkout (not library base × multiplier)';

-- Seed variants: each active library × each active bead_sizes row.
INSERT INTO public.bead_variants (
  public_id,
  bead_library_id,
  size_mm,
  unit_price,
  label,
  display_order,
  is_active,
  is_default
)
SELECT
  bl.public_id || '-' || bs.size_mm::TEXT,
  bl.id,
  bs.size_mm,
  CASE
    WHEN COALESCE(bt.uses_size_pricing, FALSE) THEN ROUND((bl.unit_price * bs.price_multiplier)::NUMERIC, 4)
    ELSE bl.unit_price
  END,
  trim(bl.name) || ' · ' || trim(bs.label),
  bs.display_order,
  TRUE,
  bs.is_default
FROM public.bead_libraries bl
JOIN public.bead_types bt ON bt.id = bl.bead_type_id
CROSS JOIN public.bead_sizes bs
WHERE bs.is_active = TRUE
ON CONFLICT (bead_library_id, size_mm) DO NOTHING;

-- Saved designs: reference variant (keep bead_size_mm as snapshot).
ALTER TABLE public.bracelet_configuration_items
  ADD COLUMN IF NOT EXISTS bead_variant_id UUID REFERENCES public.bead_variants(id) ON DELETE RESTRICT;

UPDATE public.bracelet_configuration_items ci
SET bead_variant_id = bv.id
FROM public.bead_variants bv
JOIN public.bead_libraries bl ON bl.id = bv.bead_library_id
WHERE ci.bead_library_id = bl.id
  AND bv.size_mm = ci.bead_size_mm
  AND ci.bead_variant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_bracelet_configuration_items_variant
  ON public.bracelet_configuration_items (bead_variant_id);

ALTER TABLE public.bead_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bead_variants_public_read ON public.bead_variants;
CREATE POLICY bead_variants_public_read ON public.bead_variants
  FOR SELECT TO anon, authenticated
  USING (is_active = TRUE);

COMMIT;
