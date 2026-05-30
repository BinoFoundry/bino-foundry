-- Bracelet builder bead sizes (admin-managed; drives slot count + pricing multipliers).
BEGIN;

CREATE TABLE IF NOT EXISTS public.bead_sizes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  size_mm           SMALLINT NOT NULL UNIQUE CHECK (size_mm >= 4 AND size_mm <= 24),
  label             TEXT NOT NULL,
  price_multiplier  NUMERIC(8, 4) NOT NULL DEFAULT 1 CHECK (price_multiplier > 0),
  display_order     INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  is_default        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bead_sizes_label_trim CHECK (trim(label) <> '')
);

CREATE INDEX IF NOT EXISTS idx_bead_sizes_active_sort
  ON public.bead_sizes (is_active, display_order, size_mm);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bead_sizes_single_default
  ON public.bead_sizes (is_default) WHERE is_default = TRUE;

DROP TRIGGER IF EXISTS trg_bead_sizes_updated_at ON public.bead_sizes;
CREATE TRIGGER trg_bead_sizes_updated_at
  BEFORE UPDATE ON public.bead_sizes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON TABLE public.bead_sizes IS 'Bracelet builder bead diameter options (mm) and price multipliers';

INSERT INTO public.bead_sizes (size_mm, label, price_multiplier, display_order, is_active, is_default) VALUES
  (6, '6 mm', 0.8, 10, TRUE, FALSE),
  (8, '8 mm', 1.0, 20, TRUE, TRUE),
  (10, '10 mm', 1.3, 30, TRUE, FALSE)
ON CONFLICT (size_mm) DO NOTHING;

COMMIT;
