-- Replace generic checkout_summary_items with dedicated how_we_prepare_options.
-- Apply after 000051_checkout_summary_items.sql.

BEGIN;

DROP TABLE IF EXISTS public.checkout_summary_items CASCADE;

CREATE TABLE IF NOT EXISTS public.how_we_prepare_options (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  slug                 TEXT NOT NULL UNIQUE,
  short_description    TEXT NOT NULL DEFAULT '',
  full_description     TEXT NOT NULL DEFAULT '',
  option_type          TEXT NOT NULL DEFAULT 'preparation',
  price_type           TEXT NOT NULL DEFAULT 'fixed'
    CHECK (price_type IN ('fixed', 'per_bracelet', 'per_quantity')),
  price                NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (price >= 0),
  price_label          TEXT NOT NULL DEFAULT '',
  default_quantity     INTEGER NOT NULL DEFAULT 1 CHECK (default_quantity >= 1),
  minimum_quantity     INTEGER NOT NULL DEFAULT 1 CHECK (minimum_quantity >= 1),
  maximum_quantity     INTEGER NOT NULL DEFAULT 1 CHECK (maximum_quantity >= 1),
  quantity_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  benefits             JSONB NOT NULL DEFAULT '[]'::jsonb,
  highlight_title      TEXT NOT NULL DEFAULT '',
  highlight_description TEXT NOT NULL DEFAULT '',
  badge                TEXT,
  status               TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  sort_order           INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT how_we_prepare_options_name_trim CHECK (trim(name) <> ''),
  CONSTRAINT how_we_prepare_options_slug_trim CHECK (trim(slug) <> ''),
  CONSTRAINT how_we_prepare_options_qty_bounds CHECK (minimum_quantity <= maximum_quantity),
  CONSTRAINT how_we_prepare_options_default_qty_bounds CHECK (
    default_quantity >= minimum_quantity AND default_quantity <= maximum_quantity
  )
);

CREATE INDEX IF NOT EXISTS idx_how_we_prepare_options_active_sort
  ON public.how_we_prepare_options (status, sort_order, slug);

DROP TRIGGER IF EXISTS trg_how_we_prepare_options_updated_at ON public.how_we_prepare_options;
CREATE TRIGGER trg_how_we_prepare_options_updated_at
  BEFORE UPDATE ON public.how_we_prepare_options
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON TABLE public.how_we_prepare_options IS
  'Bracelet preparation options (Ready to Wear, DIY Kit, etc.) shown before Add to Cart';

ALTER TABLE public.how_we_prepare_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS how_we_prepare_options_public_read ON public.how_we_prepare_options;
CREATE POLICY how_we_prepare_options_public_read ON public.how_we_prepare_options
  FOR SELECT USING (true);

INSERT INTO public.how_we_prepare_options (
  name,
  slug,
  short_description,
  full_description,
  option_type,
  price_type,
  price,
  price_label,
  default_quantity,
  minimum_quantity,
  maximum_quantity,
  quantity_enabled,
  benefits,
  highlight_title,
  highlight_description,
  sort_order,
  status
) VALUES
  (
    'Ready to Wear',
    'ready-to-wear',
    'We hand-string and finish your bracelet.',
    'We hand-string and finish your bracelet so it arrives ready to wear.',
    'preparation',
    'per_bracelet',
    7.00,
    '$7.00',
    1,
    1,
    1,
    FALSE,
    '[]'::jsonb,
    '',
    '',
    10,
    'active'
  ),
  (
    'DIY Kit',
    'diy-kit',
    'Beads ship loose with a stringing kit.',
    'Beads ship loose with elastic cord, a printed guide, and spare string.',
    'preparation',
    'per_quantity',
    11.00,
    '$11.00 / kit',
    1,
    1,
    10,
    TRUE,
    '["Beads pre-sorted", "Elastic cord", "Printed guide", "Spare string"]'::jsonb,
    'Made to string together',
    'Everything you need to recreate this design at home — beads sorted in order, with cord and step-by-step instructions.',
    20,
    'active'
  )
ON CONFLICT (slug) DO NOTHING;

COMMIT;
