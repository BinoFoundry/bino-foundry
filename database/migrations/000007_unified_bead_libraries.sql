-- Unified bracelet bead catalogue: bead_types + bead_libraries (replaces split crystal/charm/spacer model).
BEGIN;

-- ── Dynamic bead categories (Crystal, Charm, Spacer, Separator, …) ───────────
CREATE TABLE IF NOT EXISTS public.bead_types (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL UNIQUE,
  description   TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  metadata      JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bead_types_slug_trim CHECK (trim(slug) <> ''),
  CONSTRAINT bead_types_name_trim CHECK (trim(name) <> '')
);

CREATE INDEX IF NOT EXISTS idx_bead_types_active_sort
  ON public.bead_types (is_active, display_order, name);

DROP TRIGGER IF EXISTS trg_bead_types_updated_at ON public.bead_types;
CREATE TRIGGER trg_bead_types_updated_at
  BEFORE UPDATE ON public.bead_types
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── Unified bead library items ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bead_libraries (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id              TEXT NOT NULL UNIQUE,
  name                   TEXT NOT NULL,
  unit_price             NUMERIC(14, 4) NOT NULL CHECK (unit_price >= 0),
  currency_code          TEXT NOT NULL DEFAULT 'USD' CHECK (char_length(currency_code) = 3),
  description            TEXT NOT NULL DEFAULT '',
  bead_type_id           UUID NOT NULL REFERENCES public.bead_types(id) ON DELETE RESTRICT,
  original_asset_id      UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  processed_asset_id     UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  original_image_url     TEXT NOT NULL DEFAULT '',
  processed_image_url    TEXT NOT NULL DEFAULT '',
  crop_config            JSONB,
  crop_status            TEXT NOT NULL DEFAULT 'draft'
                           CHECK (crop_status IN ('draft', 'ready')),
  metadata               JSONB NOT NULL DEFAULT '{}'::JSONB,
  specs                  JSONB NOT NULL DEFAULT '{}'::JSONB,
  display_order          INTEGER NOT NULL DEFAULT 0,
  is_active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bead_libraries_name_trim CHECK (trim(name) <> ''),
  CONSTRAINT bead_libraries_public_id_trim CHECK (trim(public_id) <> '')
);

CREATE INDEX IF NOT EXISTS idx_bead_libraries_type_price
  ON public.bead_libraries (bead_type_id, unit_price);

CREATE INDEX IF NOT EXISTS idx_bead_libraries_public_active
  ON public.bead_libraries (public_id) WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_bead_libraries_crop_ready
  ON public.bead_libraries (crop_status) WHERE crop_status = 'ready';

DROP TRIGGER IF EXISTS trg_bead_libraries_updated_at ON public.bead_libraries;
CREATE TRIGGER trg_bead_libraries_updated_at
  BEFORE UPDATE ON public.bead_libraries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON TABLE public.bead_types IS 'Dynamic bead category taxonomy (Crystal, Charm, Spacer, …)';
COMMENT ON TABLE public.bead_libraries IS 'Unified bracelet bead catalogue with crop + storage references';
COMMENT ON COLUMN public.bead_libraries.crop_config IS 'BeadCropConfig v2 — normalized Bézier path points + asset URLs (v1 rect legacy)';

-- ── Seed canonical bead types ──────────────────────────────────────────────────
INSERT INTO public.bead_types (slug, name, description, display_order, metadata) VALUES
  ('crystal', 'Crystal', 'Faceted / round crystal beads', 10, '{"renderDefaults":{"shape":"circle"}}'::JSONB),
  ('charm', 'Charm', 'Decorative charm drops', 20, '{"renderDefaults":{"shape":"rect"}}'::JSONB),
  ('spacer', 'Spacer', 'Metal or stone spacers', 30, '{"renderDefaults":{"shape":"circle"}}'::JSONB),
  ('separator', 'Separator', 'Visual separators on strand', 40, '{}'::JSONB),
  ('accent', 'Accent', 'Small accent beads', 50, '{}'::JSONB),
  ('connector', 'Connector', 'Connectors and findings', 60, '{}'::JSONB)
ON CONFLICT (slug) DO NOTHING;

-- ── Migrate legacy crystals ────────────────────────────────────────────────────
INSERT INTO public.bead_libraries (
  public_id, name, unit_price, currency_code, description, bead_type_id,
  original_image_url, processed_image_url, crop_status, metadata, specs, display_order, is_active
)
SELECT
  c.public_id,
  c.name,
  c.unit_price,
  c.currency_code,
  c.description,
  (SELECT id FROM public.bead_types WHERE slug = 'crystal' LIMIT 1),
  COALESCE(c.specs->>'legacy_image_url', ''),
  COALESCE(c.specs->>'legacy_image_url', ''),
  CASE WHEN COALESCE(c.specs->>'legacy_image_url', '') <> '' THEN 'ready' ELSE 'draft' END,
  jsonb_build_object(
    'legacySource', 'crystals',
    'legacyCrystalTypeId', c.crystal_type_id
  ),
  c.specs,
  c.display_order,
  c.is_active
FROM public.crystals c
ON CONFLICT (public_id) DO NOTHING;

-- ── Migrate legacy charms ──────────────────────────────────────────────────────
INSERT INTO public.bead_libraries (
  public_id, name, unit_price, currency_code, description, bead_type_id,
  original_image_url, processed_image_url, crop_status, metadata, specs, display_order, is_active
)
SELECT
  c.public_id,
  c.name,
  c.unit_price,
  c.currency_code,
  c.description,
  (SELECT id FROM public.bead_types WHERE slug = 'charm' LIMIT 1),
  COALESCE(c.specs->>'legacy_image_url', ''),
  COALESCE(c.specs->>'legacy_image_url', ''),
  CASE WHEN COALESCE(c.specs->>'legacy_image_url', '') <> '' THEN 'ready' ELSE 'draft' END,
  jsonb_build_object(
    'legacySource', 'charms',
    'legacyCharmTypeId', c.charm_type_id
  ),
  c.specs,
  c.display_order,
  c.is_active
FROM public.charms c
ON CONFLICT (public_id) DO NOTHING;

-- ── Migrate legacy spacers ───────────────────────────────────────────────────────
INSERT INTO public.bead_libraries (
  public_id, name, unit_price, currency_code, description, bead_type_id,
  original_image_url, processed_image_url, crop_status, metadata, specs, display_order, is_active
)
SELECT
  s.public_id,
  s.name,
  s.unit_price,
  s.currency_code,
  s.description,
  (SELECT id FROM public.bead_types WHERE slug = 'spacer' LIMIT 1),
  COALESCE(s.specs->>'legacy_image_url', ''),
  COALESCE(s.specs->>'legacy_image_url', ''),
  CASE WHEN COALESCE(s.specs->>'legacy_image_url', '') <> '' THEN 'ready' ELSE 'draft' END,
  jsonb_build_object(
    'legacySource', 'spacers',
    'legacySpacerTypeId', s.spacer_type_id
  ),
  s.specs,
  s.display_order,
  s.is_active
FROM public.spacers s
ON CONFLICT (public_id) DO NOTHING;

-- Optional: import legacy taxonomy names into metadata for crystals (subtype labels)
-- crystal_types / charm_types / spacer_types remain for rollback; API uses bead_* tables.

COMMIT;
