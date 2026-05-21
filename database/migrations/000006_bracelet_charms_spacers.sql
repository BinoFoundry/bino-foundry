-- Bracelet catalogue expansion: charms + spacers with dedicated type systems.
BEGIN;

CREATE TABLE IF NOT EXISTS public.charm_types (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL UNIQUE,
  description   TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_charm_types_active_sort
  ON public.charm_types (is_active, display_order, name);

DROP TRIGGER IF EXISTS trg_charm_types_updated_at ON public.charm_types;
CREATE TRIGGER trg_charm_types_updated_at
  BEFORE UPDATE ON public.charm_types
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.spacer_types (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL UNIQUE,
  description   TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spacer_types_active_sort
  ON public.spacer_types (is_active, display_order, name);

DROP TRIGGER IF EXISTS trg_spacer_types_updated_at ON public.spacer_types;
CREATE TRIGGER trg_spacer_types_updated_at
  BEFORE UPDATE ON public.spacer_types
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.charms (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id              TEXT NOT NULL UNIQUE,
  name                   TEXT NOT NULL,
  unit_price             NUMERIC(14, 4) NOT NULL CHECK (unit_price >= 0),
  currency_code          TEXT NOT NULL DEFAULT 'USD' CHECK (char_length(currency_code) = 3),
  description            TEXT NOT NULL DEFAULT '',
  charm_type_id          UUID REFERENCES public.charm_types(id) ON DELETE SET NULL,
  primary_image_asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  specs                  JSONB NOT NULL DEFAULT '{}'::JSONB,
  display_order          INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT charms_name_trim CHECK (trim(name) <> '')
);

CREATE INDEX IF NOT EXISTS idx_charms_type_price
  ON public.charms (charm_type_id, unit_price);

CREATE INDEX IF NOT EXISTS idx_charms_public_active
  ON public.charms (public_id) WHERE is_active;

DROP TRIGGER IF EXISTS trg_charms_updated_at ON public.charms;
CREATE TRIGGER trg_charms_updated_at
  BEFORE UPDATE ON public.charms
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.spacers (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id              TEXT NOT NULL UNIQUE,
  name                   TEXT NOT NULL,
  unit_price             NUMERIC(14, 4) NOT NULL CHECK (unit_price >= 0),
  currency_code          TEXT NOT NULL DEFAULT 'USD' CHECK (char_length(currency_code) = 3),
  description            TEXT NOT NULL DEFAULT '',
  spacer_type_id         UUID REFERENCES public.spacer_types(id) ON DELETE SET NULL,
  primary_image_asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  specs                  JSONB NOT NULL DEFAULT '{}'::JSONB,
  display_order          INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT spacers_name_trim CHECK (trim(name) <> '')
);

CREATE INDEX IF NOT EXISTS idx_spacers_type_price
  ON public.spacers (spacer_type_id, unit_price);

CREATE INDEX IF NOT EXISTS idx_spacers_public_active
  ON public.spacers (public_id) WHERE is_active;

DROP TRIGGER IF EXISTS trg_spacers_updated_at ON public.spacers;
CREATE TRIGGER trg_spacers_updated_at
  BEFORE UPDATE ON public.spacers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMIT;
