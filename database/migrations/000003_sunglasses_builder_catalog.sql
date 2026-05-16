-- Sunglasses customiser catalog: lens tints, builder add-ons, frame colour swatches.
-- Apply after 000001_initial_catalog.sql on Supabase / Postgres.

BEGIN;

-- ── Lens tint presets (Classic / Gradient categories) ─────────────────────────
CREATE TABLE public.sunglasses_lens_tints (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL CHECK (category IN ('classic', 'gradient')),
  gradient_top    TEXT NOT NULL,
  gradient_bottom TEXT NOT NULL,
  price_surcharge NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (price_surcharge >= 0),
  currency_code   TEXT NOT NULL DEFAULT 'USD' CHECK (char_length(currency_code) = 3),
  display_order   INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sunglasses_lens_tints_name_trim CHECK (trim(name) <> ''),
  CONSTRAINT sunglasses_lens_tints_code_trim CHECK (trim(code) <> '')
);

CREATE INDEX idx_sunglasses_lens_tints_active_sort
  ON public.sunglasses_lens_tints (is_active, category, display_order);

CREATE TRIGGER trg_sunglasses_lens_tints_updated_at
  BEFORE UPDATE ON public.sunglasses_lens_tints
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON TABLE public.sunglasses_lens_tints IS 'Global lens tint presets for the sunglasses customiser (visual gradient + optional surcharge)';

-- ── Builder add-ons (polarised, prescription, future toggles) ─────────────
CREATE TABLE public.sunglasses_builder_options (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                     TEXT NOT NULL UNIQUE,
  label                    TEXT NOT NULL,
  description              TEXT NOT NULL DEFAULT '',
  price_surcharge          NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (price_surcharge >= 0),
  currency_code            TEXT NOT NULL DEFAULT 'USD' CHECK (char_length(currency_code) = 3),
  requires_manual_follow_up BOOLEAN NOT NULL DEFAULT FALSE,
  tooltip_text             TEXT,
  display_order            INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sunglasses_builder_options_code_trim CHECK (trim(code) <> ''),
  CONSTRAINT sunglasses_builder_options_label_trim CHECK (trim(label) <> '')
);

CREATE INDEX idx_sunglasses_builder_options_active_sort
  ON public.sunglasses_builder_options (is_active, display_order);

CREATE TRIGGER trg_sunglasses_builder_options_updated_at
  BEFORE UPDATE ON public.sunglasses_builder_options
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON TABLE public.sunglasses_builder_options IS 'Toggle options for sunglasses builder; surcharge applied when selected';

-- ── Frame colour swatches (customiser UI) ───────────────────────────────────
CREATE TABLE public.sunglasses_frame_colors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  hex           TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sunglasses_frame_colors_name_trim CHECK (trim(name) <> ''),
  CONSTRAINT sunglasses_frame_colors_hex_format CHECK (hex ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE INDEX idx_sunglasses_frame_colors_active_sort
  ON public.sunglasses_frame_colors (is_active, display_order);

CREATE TRIGGER trg_sunglasses_frame_colors_updated_at
  BEFORE UPDATE ON public.sunglasses_frame_colors
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── Seed defaults (matches Phase 1 prototype; edit via admin / SQL later) ───
INSERT INTO public.sunglasses_lens_tints (code, name, category, gradient_top, gradient_bottom, price_surcharge, display_order) VALUES
  ('solid-night', 'Solid Night', 'classic', '#2d3748', '#2d3748', 0, 10),
  ('clear', 'Clear', 'classic', '#e2e8f0', '#cbd5e1', 0, 20),
  ('classic-smoke', 'Classic Smoke', 'gradient', '#4a5568', '#2d3748', 0, 30),
  ('ocean-blue', 'Ocean Blue', 'gradient', '#2c5282', '#1a365d', 0, 40),
  ('sunset-fade', 'Sunset Fade', 'gradient', '#c05621', '#7b341e', 0, 50)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.sunglasses_builder_options (code, label, description, price_surcharge, requires_manual_follow_up, tooltip_text, display_order) VALUES
  ('polarized', 'Polarised lenses', 'Reduces glare', 30, FALSE, NULL, 10),
  ('prescription', 'Prescription lenses', 'Custom optical lenses', 50, TRUE, 'Up to -6.00 short-sightedness and -2.00 astigmatism', 20)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.sunglasses_frame_colors (name, hex, display_order) VALUES
  ('Matte Black', '#1a1a1a', 10),
  ('Tortoise', '#5e3a24', 20),
  ('Champagne', '#e2e8f0', 30)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.config_kv (key, value, description) VALUES
  ('sunglasses.lens_disclaimer', '"Lens appearance may vary slightly from the final product."', 'Shown under sunglasses customiser preview')
ON CONFLICT (key) DO NOTHING;

COMMIT;
