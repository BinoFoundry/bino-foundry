-- Global bead_sizes + per-library enabled sizes (replaces manual bead_variants).
BEGIN;

CREATE TABLE IF NOT EXISTS public.bead_library_sizes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bead_library_id   UUID NOT NULL REFERENCES public.bead_libraries(id) ON DELETE CASCADE,
  bead_size_id      UUID NOT NULL REFERENCES public.bead_sizes(id) ON DELETE RESTRICT,
  unit_price        NUMERIC(14, 4) NOT NULL CHECK (unit_price >= 0),
  currency_code     TEXT NOT NULL DEFAULT 'USD' CHECK (char_length(currency_code) = 3),
  is_default        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bead_library_sizes_unique_library_size UNIQUE (bead_library_id, bead_size_id)
);

CREATE INDEX IF NOT EXISTS idx_bead_library_sizes_library
  ON public.bead_library_sizes (bead_library_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bead_library_sizes_single_default
  ON public.bead_library_sizes (bead_library_id) WHERE is_default = TRUE;

DROP TRIGGER IF EXISTS trg_bead_library_sizes_updated_at ON public.bead_library_sizes;
CREATE TRIGGER trg_bead_library_sizes_updated_at
  BEFORE UPDATE ON public.bead_library_sizes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON TABLE public.bead_library_sizes IS
  'Enabled sellable sizes per bead library (many-to-many with bead_sizes); unit_price per library+size';

-- Migrate existing bead_variants into junction rows.
INSERT INTO public.bead_library_sizes (
  bead_library_id,
  bead_size_id,
  unit_price,
  currency_code,
  is_default
)
SELECT
  bv.bead_library_id,
  bs.id,
  bv.unit_price,
  bv.currency_code,
  bv.is_default
FROM public.bead_variants bv
JOIN public.bead_sizes bs ON bs.size_mm = bv.size_mm
ON CONFLICT (bead_library_id, bead_size_id) DO UPDATE
SET
  unit_price = EXCLUDED.unit_price,
  is_default = EXCLUDED.is_default;

-- Saved bracelet items: link to junction row.
ALTER TABLE public.bracelet_configuration_items
  ADD COLUMN IF NOT EXISTS bead_library_size_id UUID REFERENCES public.bead_library_sizes(id) ON DELETE RESTRICT;

UPDATE public.bracelet_configuration_items ci
SET bead_library_size_id = bls.id
FROM public.bead_library_sizes bls
JOIN public.bead_libraries bl ON bl.id = bls.bead_library_id
JOIN public.bead_sizes bs ON bs.id = bls.bead_size_id
WHERE ci.bead_library_id = bl.id
  AND bs.size_mm = ci.bead_size_mm
  AND ci.bead_library_size_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_bracelet_configuration_items_library_size
  ON public.bracelet_configuration_items (bead_library_size_id);

-- Drop variant FK/column after migration (configs resolved via library + mm).
ALTER TABLE public.bracelet_configuration_items
  DROP CONSTRAINT IF EXISTS bracelet_configuration_items_bead_variant_id_fkey;

ALTER TABLE public.bracelet_configuration_items
  DROP COLUMN IF EXISTS bead_variant_id;

DROP TABLE IF EXISTS public.bead_variants CASCADE;

ALTER TABLE public.bead_library_sizes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bead_library_sizes_public_read ON public.bead_library_sizes;
CREATE POLICY bead_library_sizes_public_read ON public.bead_library_sizes
  FOR SELECT TO anon, authenticated
  USING (TRUE);

COMMIT;
