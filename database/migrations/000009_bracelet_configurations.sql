-- Saved bracelet builder configurations (normalized; no asset blobs).
BEGIN;

-- Pricing rules in config_kv (database-driven multipliers).
INSERT INTO public.config_kv (key, value, description)
VALUES (
  'bracelet.pricing_v1',
  '{
    "sizeMultipliers": { "6": 0.8, "8": 1.0, "10": 1.3 },
    "sizePricedTypeSlugs": ["crystal", "accent"],
    "currencyCode": "USD"
  }'::JSONB,
  'Bracelet builder size multipliers and priced type slugs'
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.bracelet_configurations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id           TEXT NOT NULL UNIQUE,
  status              TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'saved', 'ordered', 'archived')),
  twinning            BOOLEAN NOT NULL DEFAULT FALSE,
  wrist_size_cm_a     NUMERIC(4, 1) NOT NULL DEFAULT 16.0
                      CHECK (wrist_size_cm_a >= 14 AND wrist_size_cm_a <= 24),
  wrist_size_cm_b     NUMERIC(4, 1) NOT NULL DEFAULT 16.0
                      CHECK (wrist_size_cm_b >= 14 AND wrist_size_cm_b <= 24),
  default_bead_size_mm SMALLINT NOT NULL DEFAULT 8
                      CHECK (default_bead_size_mm IN (6, 8, 10)),
  currency_code       TEXT NOT NULL DEFAULT 'USD' CHECK (char_length(currency_code) = 3),
  subtotal            NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  item_count          INTEGER NOT NULL DEFAULT 0 CHECK (item_count >= 0),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bracelet_configurations_public_id_trim CHECK (trim(public_id) <> '')
);

CREATE INDEX IF NOT EXISTS idx_bracelet_configurations_status_updated
  ON public.bracelet_configurations (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.bracelet_configuration_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  configuration_id      UUID NOT NULL REFERENCES public.bracelet_configurations(id) ON DELETE CASCADE,
  strand_index          SMALLINT NOT NULL DEFAULT 0 CHECK (strand_index IN (0, 1)),
  slot_position         INTEGER NOT NULL CHECK (slot_position >= 0),
  bead_library_id       UUID NOT NULL REFERENCES public.bead_libraries(id) ON DELETE RESTRICT,
  bead_size_mm          SMALLINT NOT NULL CHECK (bead_size_mm IN (6, 8, 10)),
  unit_price_snapshot   NUMERIC(14, 4) NOT NULL CHECK (unit_price_snapshot >= 0),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bracelet_configuration_items_unique_slot
    UNIQUE (configuration_id, strand_index, slot_position)
);

CREATE INDEX IF NOT EXISTS idx_bracelet_configuration_items_config
  ON public.bracelet_configuration_items (configuration_id);

CREATE INDEX IF NOT EXISTS idx_bracelet_configuration_items_bead
  ON public.bracelet_configuration_items (bead_library_id);

DROP TRIGGER IF EXISTS trg_bracelet_configurations_updated_at ON public.bracelet_configurations;
CREATE TRIGGER trg_bracelet_configurations_updated_at
  BEFORE UPDATE ON public.bracelet_configurations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON TABLE public.bracelet_configurations IS 'Saved bracelet customizer sessions (checkout-ready metadata, no render blobs)';
COMMENT ON TABLE public.bracelet_configuration_items IS 'Normalized strand slots referencing bead_libraries by UUID';
COMMENT ON COLUMN public.bracelet_configuration_items.unit_price_snapshot IS 'Unit price at save time for audit/checkout lock-in';

COMMIT;
