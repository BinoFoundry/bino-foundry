-- Bino Foundry · Phase 1 Supabase-compatible catalog schema
-- Apply via Supabase SQL editor, `supabase db push`, or `psql`.
-- Prerequisites: Postgres 14+ (Supabase default includes pgcrypto).

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Updated-at helper ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── Constraints as CHECK (easier to evolve than ENUM without migrations churn) ─
-- Allowed storage buckets must stay aligned with `@bino-foundry/shared` STORAGE_BUCKET_IDS.

-- ── Assets (Supabase Storage object registry; logic stays in backend, not Edge) ─
CREATE TABLE public.assets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket              TEXT NOT NULL
                        CHECK (bucket IN ('frames', 'crystals', 'assets', 'uploads')),
  object_key          TEXT NOT NULL,
  mime_type           TEXT,
  byte_length         BIGINT CHECK (byte_length IS NULL OR byte_length >= 0),
  etag                TEXT,
  checksum_sha256     TEXT,
  public_url          TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}'::JSONB,
  derived_from_asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT assets_bucket_object_unique UNIQUE (bucket, object_key)
);

CREATE INDEX idx_assets_bucket_prefix ON public.assets (bucket, object_key text_pattern_ops);

COMMENT ON TABLE public.assets IS 'Logical record per Supabase Storage object; versioning via derived_from_asset_id';
COMMENT ON COLUMN public.assets.object_key IS 'Relative path/key inside bucket, e.g. frames/slug/base.png';

-- ── Pricing / tuning (avoid redeploy for simple numeric toggles) ────────────
CREATE TABLE public.config_kv (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.config_kv IS 'Operational defaults (prices multipliers flags). Backend reads authoritative values.';

-- Seed examples (adjust or delete after first deploy)
INSERT INTO public.config_kv (key, value, description) VALUES
  ('catalog.frame_base_hint', '{"amount_minor":4500}', 'Reference default frame base (minor units cents, documentation only)')
ON CONFLICT (key) DO NOTHING;

DROP TRIGGER IF EXISTS trg_config_kv_updated_at ON public.config_kv;
CREATE TRIGGER trg_config_kv_updated_at
  BEFORE UPDATE ON public.config_kv
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── Crystal taxonomy ───────────────────────────────────────────────────────────
CREATE TABLE public.crystal_types (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL UNIQUE,
  description  TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crystal_types_active_sort
  ON public.crystal_types (is_active, display_order);

CREATE TRIGGER trg_crystal_types_updated_at
  BEFORE UPDATE ON public.crystal_types
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── Crystals ─────────────────────────────────────────────────────────────────
CREATE TABLE public.crystals (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id             TEXT NOT NULL UNIQUE,
  name                  TEXT NOT NULL,
  unit_price            NUMERIC(14, 4) NOT NULL CHECK (unit_price >= 0),
  currency_code         TEXT NOT NULL DEFAULT 'USD' CHECK (char_length(currency_code) = 3),
  description           TEXT NOT NULL DEFAULT '',
  crystal_type_id       UUID REFERENCES public.crystal_types(id) ON DELETE SET NULL,
  primary_image_asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  specs                 JSONB NOT NULL DEFAULT '{}'::JSONB,
  display_order        INTEGER NOT NULL DEFAULT 0,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crystals_name_trim CHECK (trim(name) <> '')
);

COMMENT ON COLUMN public.crystals.public_id IS 'Stable client-facing slug (`rose-quartz`) distinct from surrogate UUID';
COMMENT ON COLUMN public.crystals.unit_price IS 'Base catalogue price per sellable bead unit; multipliers handled in apps';
COMMENT ON COLUMN public.crystals.specs IS 'Extensible hardness, origin palette notes without schema churn';

CREATE INDEX idx_crystals_type_price ON public.crystals (crystal_type_id, unit_price);
CREATE INDEX idx_crystals_public_active ON public.crystals (public_id) WHERE is_active;

CREATE TRIGGER trg_crystals_updated_at
  BEFORE UPDATE ON public.crystals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── Frames ────────────────────────────────────────────────────────────────────
CREATE TABLE public.frames (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  base_price     NUMERIC(14, 4) NOT NULL CHECK (base_price >= 0),
  currency_code  TEXT NOT NULL DEFAULT 'USD' CHECK (char_length(currency_code) = 3),
  description    TEXT NOT NULL DEFAULT '',
  marketing_copy JSONB NOT NULL DEFAULT '{}'::JSONB,
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT frames_name_trim CHECK (trim(name) <> '')
);

COMMENT ON COLUMN public.frames.marketing_copy IS 'Long-form bullets SEO strings without rigid columns';

CREATE INDEX idx_frames_active_sort ON public.frames (is_active, display_order DESC);

CREATE TRIGGER trg_frames_updated_at
  BEFORE UPDATE ON public.frames
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── Ordered gallery assets per frame (hero / detail / marketing) ───────────────
CREATE TABLE public.frame_media (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  frame_id    UUID NOT NULL REFERENCES public.frames(id) ON DELETE CASCADE,
  asset_id    UUID NOT NULL REFERENCES public.assets(id) ON DELETE RESTRICT,
  role        TEXT NOT NULL DEFAULT 'hero'
              CHECK (role IN ('hero', 'marketing', 'detail', 'technical', 'mask', 'ambient')),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT frame_media_unique_slot UNIQUE (frame_id, asset_id),
  CONSTRAINT frame_media_role_sort UNIQUE (frame_id, role, sort_order)
);

CREATE INDEX idx_frame_media_frame ON public.frame_media (frame_id, sort_order);

COMMENT ON TABLE public.frame_media IS 'Composable 2D layer inputs; resolves to CDN URLs via assets.public_url';

-- ── Tint / shade plates per SKU ───────────────────────────────────────────────
CREATE TABLE public.frame_lens_tints (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  frame_id       UUID NOT NULL REFERENCES public.frames(id) ON DELETE CASCADE,
  tint_code      TEXT NOT NULL,
  label          TEXT NOT NULL,
  swatch_asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  tint_image_asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE RESTRICT,
  hex_preview    TEXT,
  display_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT frame_lens_unique_code UNIQUE (frame_id, tint_code),
  CONSTRAINT frame_lens_label_trim CHECK (trim(label) <> '')
);

COMMENT ON COLUMN public.frame_lens_tints.tint_code IS 'Machine-readable token for builder state & APIs';
COMMENT ON COLUMN public.frame_lens_tints.hex_preview IS 'Optional UI swatch shortcut when no swatch_asset';

CREATE INDEX idx_frame_lens_sort ON public.frame_lens_tints (frame_id, display_order);

CREATE TRIGGER trg_frame_lens_updated_at
  BEFORE UPDATE ON public.frame_lens_tints
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── Cross-product tagging (campaigns collaborations) ───────────────────────────
CREATE TABLE public.collection_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  channel     TEXT NOT NULL DEFAULT 'web' CHECK (channel IN ('web', 'campaign', 'wholesale')),
  description TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.collection_tag_links (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_tag_id   UUID NOT NULL REFERENCES public.collection_tags(id) ON DELETE CASCADE,
  frame_id            UUID REFERENCES public.frames(id) ON DELETE CASCADE,
  crystal_id          UUID REFERENCES public.crystals(id) ON DELETE CASCADE,
  CONSTRAINT collection_tag_exactly_one_ck CHECK (
      (CASE WHEN frame_id IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN crystal_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  )
);

COMMENT ON CONSTRAINT collection_tag_exactly_one_ck ON public.collection_tag_links IS 'Exactly one of frame_id or crystal_id MUST be populated for each merchandising bridge row';

CREATE UNIQUE INDEX uq_collection_tag_links_frame_tag
  ON public.collection_tag_links (collection_tag_id, frame_id)
  WHERE crystal_id IS NULL AND frame_id IS NOT NULL;

CREATE UNIQUE INDEX uq_collection_tag_links_crystal_tag
  ON public.collection_tag_links (collection_tag_id, crystal_id)
  WHERE frame_id IS NULL AND crystal_id IS NOT NULL;

CREATE INDEX idx_collection_tag_links_tag ON public.collection_tag_links (collection_tag_id);

COMMENT ON TABLE public.collection_tag_links IS 'Many-to-many between merchandising buckets and SKU rows; FK path chosen per row';

COMMIT;
