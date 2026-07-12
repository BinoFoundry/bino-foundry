-- Configurable checkout summary blocks for the bracelet builder (and future builders).
-- Apply after 000050_bead_render_calibration_factor.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS public.checkout_summary_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             TEXT NOT NULL UNIQUE,
  title            TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  body_template    TEXT NOT NULL DEFAULT '',
  icon             TEXT,
  item_kind        TEXT NOT NULL CHECK (item_kind IN ('metric', 'total', 'addon', 'note')),
  unit_price       NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  pricing_mode     TEXT NOT NULL DEFAULT 'per_order' CHECK (pricing_mode IN ('per_order', 'per_bracelet')),
  default_selected BOOLEAN NOT NULL DEFAULT FALSE,
  display_order    INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  visibility_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT checkout_summary_items_slug_trim CHECK (trim(slug) <> ''),
  CONSTRAINT checkout_summary_items_title_trim CHECK (trim(title) <> '')
);

CREATE INDEX IF NOT EXISTS idx_checkout_summary_items_enabled_sort
  ON public.checkout_summary_items (is_enabled, display_order, slug);

DROP TRIGGER IF EXISTS trg_checkout_summary_items_updated_at ON public.checkout_summary_items;
CREATE TRIGGER trg_checkout_summary_items_updated_at
  BEFORE UPDATE ON public.checkout_summary_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON TABLE public.checkout_summary_items IS
  'Admin-managed checkout summary rows (metrics, totals, add-ons, notes) with placeholder templates';

ALTER TABLE public.checkout_summary_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS checkout_summary_items_public_read ON public.checkout_summary_items;
CREATE POLICY checkout_summary_items_public_read ON public.checkout_summary_items
  FOR SELECT USING (true);

INSERT INTO public.checkout_summary_items (
  slug, title, description, body_template, item_kind, display_order, is_enabled
) VALUES
  (
    'subtotal',
    'Subtotal',
    '',
    '{subtotal}',
    'metric',
    10,
    TRUE
  ),
  (
    'estimated-total',
    'Estimated total',
    'Prices in {currency} · Confirmed at checkout',
    '{estimated_total}',
    'total',
    20,
    TRUE
  ),
  (
    'diy-kit',
    'DIY Kit',
    'Everything you need to restring your bracelet at home',
    '',
    'addon',
    30,
    FALSE
  )
ON CONFLICT (slug) DO NOTHING;

UPDATE public.checkout_summary_items
SET
  unit_price = 15.00,
  pricing_mode = 'per_order',
  default_selected = FALSE
WHERE slug = 'diy-kit';

COMMIT;
